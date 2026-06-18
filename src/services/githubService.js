const GITHUB_API_BASE = 'https://api.github.com/repos/zwqZWQ123/cloud-intel';
const RAW_CONTENT_BASE = 'https://raw.githubusercontent.com/zwqZWQ123/cloud-intel/master';

export const cloudVendors = [
  { id: 'aliyun', name: '阿里云', icon: '☁️', color: '#FF6A00' },
  { id: 'tencent', name: '腾讯云', icon: '☁️', color: '#00A4FF' },
  { id: 'huawei', name: '华为云', icon: '☁️', color: '#FF0000' },
  { id: 'aws', name: 'AWS', icon: '☁️', color: '#FF9900' },
  { id: 'azure', name: 'Azure', icon: '☁️', color: '#0078D4' }
];

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
  const result = {
    date,
    title: '',
   采集时间: '',
   来源: '',
    overview: {
      total: 0,
      high: 0,
      medium: 0,
      low: 0
    },
   采集说明: '',
    vendors: [],
    alerts: [],
   延续动态: [],
    recent7Days: [],
    rawContent: content
  };

  let currentSection = null;
  let currentVendor = null;
  let currentPriority = null;
  let currentItem = null;
  let inAlertSection = false;
  let inRecent7DaysSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) {
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }
      continue;
    }

    // 一级标题 - 文档标题
    if (trimmedLine.startsWith('# ')) {
      result.title = trimmedLine.substring(2).trim();
      continue;
    }

    // 提取元信息
    if (trimmedLine.startsWith('>')) {
      const metaMatch = trimmedLine.match(/采集时间：([^|]+)/);
      if (metaMatch) result.采集时间 = metaMatch[1].trim();
      const sourceMatch = trimmedLine.match(/来源：(.+)/);
      if (sourceMatch) result.来源 = sourceMatch[1].trim();
      continue;
    }

    // 二级标题 - 大章节
    if (trimmedLine.startsWith('## ')) {
      // 保存当前项目
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }
      // 保存当前厂商
      if (currentVendor) {
        result.vendors.push(currentVendor);
      }

      const sectionName = trimmedLine.substring(3).trim();
      
      if (sectionName.includes('📊') || sectionName.includes('今日概览')) {
        currentSection = 'overview';
        currentVendor = null;
      } else if (sectionName.includes('数据采集说明') || sectionName.includes('⚠️ 数据采集')) {
        currentSection = '采集说明';
        currentVendor = null;
      } else if (sectionName.includes('☁️')) {
        // 云厂商
        currentSection = 'vendor';
        currentVendor = {
          name: sectionName.replace(/☁️\s*/, '').trim(),
          id: extractVendorId(sectionName),
          items: []
        };
        currentPriority = null;
      } else if (sectionName.includes('延续') || sectionName.includes('📝')) {
        currentSection = '延续动态';
        currentVendor = null;
      } else if (sectionName.includes('活跃告警') || sectionName.includes('⚠️ 活跃告警')) {
        currentSection = 'alerts';
        currentVendor = null;
        inAlertSection = true;
      } else if (sectionName.includes('最近7日') || sectionName.includes('📅')) {
        currentSection = 'recent7Days';
        currentVendor = null;
        inRecent7DaysSection = true;
      } else {
        currentSection = null;
        currentVendor = null;
      }
      continue;
    }

    // 三级标题 - 优先级
    if (trimmedLine.startsWith('### ')) {
      // 保存当前项目
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }

      const priorityName = trimmedLine.substring(4).trim();
      currentPriority = parsePriority(priorityName);
      
      // 检查是否有延续标记
      if (priorityName.includes('(延续)') || priorityName.includes('延续')) {
        currentPriority.isExtended = true;
      }
      continue;
    }

    // 四级标题 - 项目标题
    if (trimmedLine.startsWith('#### ') || /^\d+\./.test(trimmedLine)) {
      // 保存当前项目
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
      }

      let title = trimmedLine.replace(/^\d+\.\s*/, '').trim();
      currentItem = {
        title,
        cleanTitle: cleanTitle(title),
        priority: currentPriority,
        type: '',
        摘要: '',
        影响范围: '',
        日期: '',
        来源: ''
      };
      continue;
    }

    // 列表项 - 项目属性
    if (trimmedLine.startsWith('- ')) {
      const fieldMatch = trimmedLine.match(/^\*\*(.+?)\*\*[：:]\s*(.+)/);
      if (fieldMatch && currentItem) {
        const fieldName = fieldMatch[1].trim();
        const fieldValue = fieldMatch[2].trim();
        
        if (fieldName === '类型') {
          currentItem.type = fieldValue;
        } else if (fieldName === '摘要') {
          currentItem.摘要 = fieldValue;
        } else if (fieldName === '影响范围') {
          currentItem.影响范围 = fieldValue;
        } else if (fieldName === '日期') {
          currentItem.日期 = fieldValue;
        } else if (fieldName === '紧急程度') {
          currentItem.紧急程度 = fieldValue;
        }
      }
      continue;
    }

    // 来源链接
    if (trimmedLine.startsWith('- **来源**') || trimmedLine.includes('来源：')) {
      const urlMatch = trimmedLine.match(/https?:\/\/[^\s\)]+/);
      if (urlMatch && currentItem) {
        currentItem.来源 = urlMatch[0];
      }
      continue;
    }

    // 概览统计
    if (currentSection === 'overview' && trimmedLine.includes('**')) {
      const statMatch = trimmedLine.match(/\*\*([^*]+)\*\*[：:]\s*(\d+)/);
      if (statMatch) {
        const label = statMatch[1].trim();
        const count = parseInt(statMatch[2]);
        
        if (label.includes('总采集') || label.includes('总')) {
          result.overview.total = count;
        } else if (label.includes('高优先') || label.includes('🔴')) {
          result.overview.high = count;
        } else if (label.includes('中优先') || label.includes('🟡')) {
          result.overview.medium = count;
        } else if (label.includes('低优先') || label.includes('🟢')) {
          result.overview.low = count;
        }
      }
      continue;
    }

    // 采集说明
    if (currentSection === '采集说明') {
      if (trimmedLine.includes('**')) {
        result.采集说明 = trimmedLine;
      }
      continue;
    }

    // 告警解析
    if (inAlertSection) {
      if (trimmedLine.includes('**') && trimmedLine.includes('-')) {
        const alertMatch = trimmedLine.match(/\*\*([^*]+)\*\*\s*[-–—]\s*(.+)/);
        if (alertMatch) {
          result.alerts.push({
            vendor: alertMatch[1].trim(),
            description: alertMatch[2].trim()
          });
        }
      }
      continue;
    }

    // 7日回顾表格解析
    if (inRecent7DaysSection && trimmedLine.includes('|')) {
      if (!trimmedLine.includes('---') && !trimmedLine.includes('日期')) {
        const cells = trimmedLine.split('|').filter(cell => cell.trim());
        if (cells.length >= 6) {
          result.recent7Days.push({
            date: cells[0].trim(),
            aws: cells[1].trim(),
            azure: cells[2].trim(),
            aliyun: cells[3].trim(),
            tencent: cells[4].trim(),
            huawei: cells[5].trim()
          });
        }
      }
      continue;
    }
  }

  // 保存最后一个项目
  if (currentItem && currentVendor) {
    currentVendor.items.push(currentItem);
  }
  
  // 保存最后一个厂商
  if (currentVendor) {
    result.vendors.push(currentVendor);
  }

  return result;
}

function extractVendorId(vendorName) {
  const nameLower = vendorName.toLowerCase();
  
  if (nameLower.includes('aws') || nameLower.includes('亚马逊')) {
    return 'aws';
  }
  if (nameLower.includes('azure') || nameLower.includes('微软')) {
    return 'azure';
  }
  if (nameLower.includes('阿里')) {
    return 'aliyun';
  }
  if (nameLower.includes('腾讯')) {
    return 'tencent';
  }
  if (nameLower.includes('华为')) {
    return 'huawei';
  }
  
  return 'other';
}

function parsePriority(text) {
  if (text.includes('高优先') || text.includes('🔴')) {
    return { level: 'high', name: '高优先级', color: '#FF0000', icon: '🔴' };
  }
  if (text.includes('中优先') || text.includes('🟡')) {
    return { level: 'medium', name: '中优先级', color: '#FAAD14', icon: '🟡' };
  }
  if (text.includes('低优先') || text.includes('🟢')) {
    return { level: 'low', name: '低优先级', color: '#52C41A', icon: '🟢' };
  }
  return { level: 'other', name: '其他', color: '#1890FF', icon: '⚪' };
}

function cleanTitle(title) {
  return title
    .replace(/^[\d.]+\s*/, '')
    .replace(/【[^】]+】\s*/, '')
    .replace(/^[-–—]\s*/, '')
    .replace(/\(延续\)/g, '')
    .trim();
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
