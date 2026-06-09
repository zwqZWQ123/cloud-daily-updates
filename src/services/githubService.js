const GITHUB_API_BASE = 'https://api.github.com/repos/zwqZWQ123/cloud-intel';
const RAW_CONTENT_BASE = 'https://raw.githubusercontent.com/zwqZWQ123/cloud-intel/master';

export const cloudVendors = [
  { id: 'aliyun', name: '阿里云', color: '#FF6A00' },
  { id: 'tencent', name: '腾讯云', color: '#00A4FF' },
  { id: 'huawei', name: '华为云', color: '#FF0000' },
  { id: 'aws', name: 'AWS', color: '#FF9900' },
  { id: 'azure', name: 'Azure', color: '#0078D4' }
];

const vendorMappings = [
  { keywords: ['阿里云', 'aliyun', 'alibaba'], id: 'aliyun', name: '阿里云' },
  { keywords: ['腾讯云', 'tencent'], id: 'tencent', name: '腾讯云' },
  { keywords: ['华为云', 'huawei'], id: 'huawei', name: '华为云' },
  { keywords: ['亚马逊', 'aws', 'amazon'], id: 'aws', name: 'AWS' },
  { keywords: ['微软云', 'azure', 'microsoft'], id: 'azure', name: 'Azure' }
];

function getVendorInfo(vendorName) {
  const nameLower = vendorName.toLowerCase();
  
  for (const mapping of vendorMappings) {
    for (const keyword of mapping.keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        return { id: mapping.id, name: mapping.name };
      }
    }
  }
  
  return { id: 'other', name: vendorName };
}

function extractVendorFromTitle(title) {
  const bracketMatch = title.match(/【([^】]+)】/);
  if (bracketMatch) {
    return getVendorInfo(bracketMatch[1]);
  }
  
  return getVendorInfo(title);
}

export async function fetchDailyFiles() {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/contents/cloud-intel/daily?ref=master`);
    if (!response.ok) {
      throw new Error('Failed to fetch daily files');
    }
    const files = await response.json();
    
    const markdownFiles = files.filter(file => 
      file.type === 'file' && file.name.endsWith('.md')
    );
    
    markdownFiles.sort((a, b) => {
      const dateA = new Date(a.name.replace('.md', ''));
      const dateB = new Date(b.name.replace('.md', ''));
      return dateB - dateA;
    });
    
    return markdownFiles;
  } catch (error) {
    console.error('Error fetching daily files:', error);
    return [];
  }
}

export async function fetchDailyContent(date) {
  try {
    const response = await fetch(`${RAW_CONTENT_BASE}/cloud-intel/daily/${date}.md`);
    if (!response.ok) {
      throw new Error('Failed to fetch daily content');
    }
    const content = await response.text();
    return parseMarkdownContent(content, date);
  } catch (error) {
    console.error('Error fetching daily content:', error);
    return null;
  }
}

function parseMarkdownContent(content, date) {
  const lines = content.split('\n');
  const allItems = [];
  
  let currentPriority = null;
  let currentItemTitle = null;
  let currentItemContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('## ')) {
      const priorityText = trimmedLine.substring(3).trim();
      currentPriority = parsePriority(priorityText);
      currentItemTitle = null;
      currentItemContent = [];
      continue;
    }
    
    if (trimmedLine.startsWith('### ')) {
      if (currentItemTitle) {
        const vendorInfo = extractVendorFromTitle(currentItemTitle);
        allItems.push({
          title: currentItemTitle,
          cleanTitle: cleanTitle(currentItemTitle),
          vendorId: vendorInfo.id,
          vendorName: vendorInfo.name,
          priority: currentPriority,
          content: currentItemContent.join('\n')
        });
      }
      
      currentItemTitle = trimmedLine.substring(4).trim();
      currentItemContent = [];
      continue;
    }
    
    if (currentItemTitle && trimmedLine && !trimmedLine.startsWith('---')) {
      currentItemContent.push(line);
    }
  }
  
  if (currentItemTitle) {
    const vendorInfo = extractVendorFromTitle(currentItemTitle);
    allItems.push({
      title: currentItemTitle,
      cleanTitle: cleanTitle(currentItemTitle),
      vendorId: vendorInfo.id,
      vendorName: vendorInfo.name,
      priority: currentPriority,
      content: currentItemContent.join('\n')
    });
  }
  
  const vendorSections = groupItemsByVendor(allItems);
  
  return {
    date,
    sections: vendorSections,
    allItems: allItems,
    rawContent: content
  };
}

function parsePriority(text) {
  if (text.includes('高优先') || text.includes('🔴')) {
    return { level: 'high', name: '高优先级', color: '#FF0000' };
  }
  if (text.includes('中优先') || text.includes('🟡')) {
    return { level: 'medium', name: '中优先级', color: '#FAAD14' };
  }
  if (text.includes('低优先') || text.includes('🟢')) {
    return { level: 'low', name: '低优先级', color: '#52C41A' };
  }
  return { level: 'other', name: '其他', color: '#1890FF' };
}

function cleanTitle(title) {
  return title
    .replace(/^[\d.]+\s*/, '')
    .replace(/【[^】]+】\s*/, '')
    .replace(/^[-–—]\s*/, '')
    .trim();
}

function groupItemsByVendor(items) {
  const vendorMap = new Map();
  
  for (const item of items) {
    if (!vendorMap.has(item.vendorId)) {
      vendorMap.set(item.vendorId, {
        vendor: item.vendorName,
        vendorId: item.vendorId,
        items: []
      });
    }
    vendorMap.get(item.vendorId).items.push(item);
  }
  
  const sections = [];
  const orderedVendorIds = ['aws', 'azure', 'aliyun', 'tencent', 'huawei', 'other'];
  
  for (const vendorId of orderedVendorIds) {
    if (vendorMap.has(vendorId)) {
      const section = vendorMap.get(vendorId);
      section.items.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2, other: 3 };
        return priorityOrder[a.priority.level] - priorityOrder[b.priority.level];
      });
      sections.push(section);
    }
  }
  
  return sections;
}

export async function fetchAllDailyContents() {
  const files = await fetchDailyFiles();
  const contents = [];
  
  for (const file of files) {
    const date = file.name.replace('.md', '');
    const content = await fetchDailyContent(date);
    if (content) {
      contents.push(content);
    }
  }
  
  return contents;
}
