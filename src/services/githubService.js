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

/**
 * 解析 Markdown 内容
 * 支持以下格式：
 * 1. 6月4日-6月8日：## 📌 详细条目 + ### 厂商 🟢/🟡/🔴 + 数字列表
 * 2. 6月9日-6月13日：## 🟡 中优先级 + ### 1. 【厂商】标题
 * 3. 6月14日及之后：## 📝 延续昨日动态 + ### 🟡 中优先级 (延续)
 */
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
    采集说明: [],
    vendors: [],
    alerts: [],
    recent7Days: [],
    其他动态: [],
    rawContent: content
  };

  // 存储所有动态（按厂商分组）
  const vendorMap = new Map();
  const getOrCreateVendor = (name) => {
    if (!vendorMap.has(name)) {
      vendorMap.set(name, {
        name: cleanVendorName(name),
        id: extractVendorId(name),
        items: [],
        note: ''
      });
    }
    return vendorMap.get(name);
  };

  let currentSection = null;
  let currentVendor = null;
  let currentPriority = null;
  let currentItem = null;
  let inAlertSection = false;
  let inRecent7DaysSection = false;
  let inCollectionSection = false;
  let inOtherSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }
      continue;
    }

    // 一级标题
    if (trimmedLine.startsWith('# ')) {
      result.title = trimmedLine.substring(2).trim();
      continue;
    }

    // 提取元信息
    if (trimmedLine.startsWith('>')) {
      const metaMatch = trimmedLine.match(/采集时间[：:]\s*([^|]+)/);
      if (metaMatch) result.采集时间 = metaMatch[1].trim();
      const sourceMatch = trimmedLine.match(/来源[：:]\s*(.+)/);
      if (sourceMatch) result.来源 = sourceMatch[1].trim();
      
      // 采集说明中的引用块
      if (inCollectionSection) {
        result.采集说明.push(trimmedLine.replace(/^>\s*/, ''));
      }
      continue;
    }

    // 二级标题 - 大章节
    if (trimmedLine.startsWith('## ')) {
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }

      const sectionName = trimmedLine.substring(3).trim();
      
      // 重置状态
      inAlertSection = false;
      inRecent7DaysSection = false;
      inCollectionSection = false;
      inOtherSection = false;
      currentVendor = null;

      if (sectionName.includes('📊') || sectionName.includes('今日概览')) {
        currentSection = 'overview';
      } else if (sectionName.includes('数据采集说明') || sectionName.includes('⚠️ 数据采集')) {
        currentSection = '采集说明';
        inCollectionSection = true;
        result.采集说明 = [];
      } else if (sectionName.includes('📌 详细条目') || sectionName.includes('详细条目')) {
        // 6月4日-6月8日格式
        currentSection = 'detail';
      } else if (sectionName.includes('今日动态汇总') || sectionName.includes('📋 今日')) {
        currentSection = 'summary';
      } else if (sectionName.includes('高优先级') || sectionName.includes('🔴 高')) {
        currentSection = 'high';
        currentPriority = { level: 'high', name: '高优先级', color: '#FF4D4F', icon: '🔴' };
      } else if (sectionName.includes('中优先级') || sectionName.includes('🟡 中')) {
        currentSection = 'medium';
        currentPriority = { level: 'medium', name: '中优先级', color: '#FAAD14', icon: '🟡' };
      } else if (sectionName.includes('低优先级') || sectionName.includes('� 低')) {
        currentSection = 'low';
        currentPriority = { level: 'low', name: '低优先级', color: '#52C41A', icon: '🟢' };
      } else if (sectionName.includes('其他动态') || sectionName.includes('📝 其他')) {
        currentSection = 'other';
        inOtherSection = true;
      } else if (sectionName.includes('延续') || sectionName.includes('📝 延续')) {
        currentSection = 'extended';
      } else if (sectionName.includes('活跃告警') || sectionName.includes('⚠️ 活跃') || sectionName.includes('🚨')) {
        currentSection = 'alerts';
        inAlertSection = true;
      } else if (sectionName.includes('最近7日') || sectionName.includes('📅')) {
        currentSection = 'recent7Days';
        inRecent7DaysSection = true;
      } else if (sectionName.includes('备注') || sectionName.includes('📝 备注')) {
        currentSection = 'notes';
      } else if (sectionName.includes('统计') || sectionName.includes('📊 统计')) {
        currentSection = 'stats';
      } else {
        currentSection = 'other';
      }
      continue;
    }

    // 三级标题 - 优先级或厂商
    if (trimmedLine.startsWith('### ')) {
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
        currentItem = null;
      }

      const sectionName = trimmedLine.substring(4).trim();
      
      // 判断是优先级标题还是厂商标题
      if (isPrioritySection(sectionName)) {
        // 优先级标题 (如：### 🟡 中优先级 (延续))
        const priority = parsePriority(sectionName);
        if (sectionName.includes('延续')) {
          priority.isExtended = true;
        }
        currentPriority = priority;
        currentVendor = null;
      } else {
        // 厂商标题 (如：### AWS 🟢、### Azure 🟢、### 阿里云 🟡 中)
        // 提取厂商名
        const vendorName = extractVendorNameFromHeader(sectionName);
        currentVendor = getOrCreateVendor(vendorName);
        
        // 提取标题中的优先级图标
        if (sectionName.includes('🔴')) {
          currentPriority = { level: 'high', name: '高优先级', color: '#FF4D4F', icon: '🔴' };
        } else if (sectionName.includes('🟡')) {
          currentPriority = { level: 'medium', name: '中优先级', color: '#FAAD14', icon: '🟡' };
        } else if (sectionName.includes('🟢')) {
          currentPriority = { level: 'low', name: '低优先级', color: '#52C41A', icon: '🟢' };
        } else if (sectionName.includes('⚪') || sectionName.includes('待确认')) {
          currentPriority = { level: 'other', name: '待确认', color: '#8C8C8C', icon: '⚪' };
        } else {
          // 标题中包含【类型】标记
          const typeMatch = sectionName.match(/【(.+?)】/);
          if (typeMatch) {
            currentPriority = { level: 'medium', name: typeMatch[1], color: '#FAAD14', icon: '🟡' };
          } else {
            currentPriority = { level: 'other', name: '其他', color: '#8C8C8C', icon: '⚪' };
          }
        }
      }
      continue;
    }

    // 项目标题
    const itemTitleResult = parseItemTitle(trimmedLine);
    if (itemTitleResult) {
      if (currentItem && currentVendor) {
        currentVendor.items.push({...currentItem});
      }

      // 确定厂商
      let vendor = currentVendor;
      if (itemTitleResult.vendorName) {
        // 标题中包含【厂商】标记
        vendor = getOrCreateVendor(itemTitleResult.vendorName);
      }
      
      // 确定优先级
      let priority = currentPriority;
      if (itemTitleResult.priorityHint) {
        priority = itemTitleResult.priorityHint;
      }

      currentItem = {
        title: itemTitleResult.title,
        cleanTitle: itemTitleResult.cleanTitle,
        priority: priority,
        type: '',
        摘要: '',
        详情: '',
        影响范围: '',
        日期: '',
        紧急程度: '',
        来源: '',
        isExtended: priority?.isExtended || (itemTitleResult.cleanTitle && itemTitleResult.cleanTitle.includes('延续'))
      };

      if (vendor) {
        currentVendor = vendor;
      }
      continue;
    }

    // 列表项 - 项目属性
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('  - ')) {
      // 处理两种格式：
      // 1. - **字段名**：值
      // 2. - 字段名：值
      
      let fieldMatch = trimmedLine.match(/^\s*-\s*\*\*(.+?)\*\*[：:]\s*(.+)/);
      if (!fieldMatch) {
        // 尝试匹配普通格式
        fieldMatch = trimmedLine.match(/^\s*-\s*([^：:]+)[：:]\s*(.+)/);
      }
      
      if (fieldMatch && currentItem) {
        const fieldName = fieldMatch[1].replace(/\*\*/g, '').trim();
        let fieldValue = fieldMatch[2].trim();
        
        if (fieldName === '类型') {
          currentItem.type = fieldValue;
        } else if (fieldName === '摘要') {
          currentItem.摘要 = fieldValue;
        } else if (fieldName === '详情') {
          currentItem.详情 = fieldValue;
        } else if (fieldName === '影响范围' || fieldName === '影响') {
          currentItem.影响范围 = fieldValue;
        } else if (fieldName === '日期') {
          currentItem.日期 = fieldValue;
        } else if (fieldName === '紧急程度' || fieldName === '紧急度') {
          currentItem.紧急程度 = fieldValue;
        } else if (fieldName === '来源' || fieldName === '区域' || fieldName === '服务') {
          // 尝试提取URL
          const urlMatch = fieldValue.match(/https?:\/\/[^\s\)]+/);
          if (urlMatch) {
            currentItem.来源 = urlMatch[0];
          } else if (fieldName === '来源') {
            currentItem.来源 = fieldValue;
          } else if (fieldName === '区域') {
            currentItem.区域 = fieldValue;
          } else if (fieldName === '服务') {
            currentItem.服务 = fieldValue;
          }
        }
      }
      
      // 处理"来源：[标题](URL)"格式
      if (currentItem && trimmedLine.match(/^\s*-\s*来源/)) {
        const linkMatch = trimmedLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          currentItem.来源 = linkMatch[2];
          currentItem.来源标题 = linkMatch[1];
        }
      }
      continue;
    }

    // 厂商段落注释（如"暂无最新抓取数据"）
    if (currentVendor && currentVendor.items.length === 0 && currentItem === null) {
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const note = trimmedLine.replace(/^[-*]\s*/, '').trim();
        if (note && !note.startsWith('**') && !note.match(/^\d+\./)) {
          if (currentVendor.note) {
            currentVendor.note += ' ' + note;
          } else {
            currentVendor.note = note;
          }
        }
      }
    }

    // 概览统计
    if (currentSection === 'overview' && trimmedLine.includes('**')) {
      const statMatch = trimmedLine.match(/\*\*([^*]+)\*\*[：:]\s*(\d+|待[更统][新计]|约?\s*\d+)/);
      if (statMatch) {
        const label = statMatch[1].trim();
        let value = statMatch[2].trim();
        if (value.includes('约')) {
          value = value.replace(/约\s*/, '');
        }
        const count = parseInt(value) || 0;
        
        if (label.includes('总采集') || label.includes('总') || label.includes('今日采集')) {
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

    // 统计区域（老格式）
    if (currentSection === 'stats' && trimmedLine.includes('**')) {
      const statMatch = trimmedLine.match(/\*\*([^*]+)\*\*[：:]\s*(\d+|待[更统][新计])/);
      if (statMatch) {
        const label = statMatch[1].trim();
        const count = parseInt(statMatch[2]) || 0;
        
        if (label.includes('总采集') || label.includes('总') || label.includes('今日采集')) {
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

    // 采集说明（普通格式）
    if (inCollectionSection && !trimmedLine.startsWith('>') && trimmedLine.includes('**')) {
      result.采集说明.push(trimmedLine);
      continue;
    }

    // 告警解析
    if (inAlertSection) {
      if (trimmedLine.includes('-') && !trimmedLine.startsWith('##')) {
        // 处理表格行或列表
        if (trimmedLine.startsWith('|')) {
          // 表格行
          const cells = trimmedLine.split('|').filter(cell => cell.trim());
          if (cells.length >= 3 && !cells[0].includes('---')) {
            result.alerts.push({
              icon: '⚠️',
              vendor: cells[0].trim(),
              type: cells[1].trim(),
              description: cells[2].trim(),
              urgency: cells[3] ? cells[3].trim() : ''
            });
          }
        } else if (trimmedLine.match(/^[🔴🟠🟡🟢⚠️]/)) {
          const emojiMatch = trimmedLine.match(/^([🔴🟠🟡🟢⚠️])\s*(.+)/);
          if (emojiMatch) {
            const parts = emojiMatch[2].split(/\s*[-–—]\s*/);
            result.alerts.push({
              icon: emojiMatch[1],
              vendor: parts[0]?.trim() || '',
              description: parts[1]?.trim() || emojiMatch[2]
            });
          }
        }
      }
      continue;
    }

    // 7日回顾表格解析
    if (inRecent7DaysSection && trimmedLine.includes('|')) {
      if (!trimmedLine.includes('---') && !trimmedLine.includes('日期') && !trimmedLine.includes('厂商')) {
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

    // 其他动态区域
    if (inOtherSection) {
      if (trimmedLine.startsWith('### ')) {
        // 已经在前面处理
        continue;
      }
      if (trimmedLine.startsWith('- ')) {
        const text = trimmedLine.replace(/^-\s*/, '').trim();
        if (text && !text.match(/^\*\*[^*]+\*\*/)) {
          if (result.其他动态.length < 50) { // 防止过多
            result.其他动态.push({
              vendor: currentVendor ? currentVendor.name : '其他',
              text: text
            });
          }
        }
      }
    }
  }

  // 保存最后一个项目
  if (currentItem && currentVendor) {
    currentVendor.items.push(currentItem);
  }

  // 转换为数组并按厂商排序
  result.vendors = Array.from(vendorMap.values())
    .filter(v => v.items.length > 0 || v.note)
    .sort((a, b) => {
      // 优先排序有动态的厂商
      if (a.items.length > 0 && b.items.length === 0) return -1;
      if (a.items.length === 0 && b.items.length > 0) return 1;
      return 0;
    });

  return result;
}

/**
 * 判断是否是优先级章节标题
 */
function isPrioritySection(text) {
  return /[🔴🟡🟢].*(高优先|中优先|低优先)/.test(text) ||
         /^高优先级/.test(text) ||
         /^中优先级/.test(text) ||
         /^低优先级/.test(text) ||
         /^\d+\./.test(text) || // 数字开头的（如：### 1. 【腾讯云】...）
         /【.+?】/.test(text); // 【】标记开头的
}

/**
 * 从标题中提取厂商名
 */
function extractVendorNameFromHeader(text) {
  // 移除优先级图标
  let name = text
    .replace(/^[🔴🟠🟡🟢⚪]\s*/, '')
    .replace(/\s*[🔴🟠🟡🟢⚪]\s*$/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
  
  // 提取【】中的内容作为类型提示
  const typeMatch = name.match(/【(.+?)】/);
  if (typeMatch) {
    // 检查【】中是否包含厂商关键词
    const inner = typeMatch[1];
    if (inner.includes('AWS') || inner.includes('Azure') || 
        inner.includes('阿里') || inner.includes('腾讯') || inner.includes('华为')) {
      return inner;
    }
    // 如果不是厂商，保留整个标题作为名称
    return name;
  }
  
  return name;
}

/**
 * 解析项目标题
 * 返回 { title, cleanTitle, vendorName, priorityHint }
 */
function parseItemTitle(text) {
  // 格式1：1. **【腾讯云】标题** (2026-06-03)
  let match = text.match(/^(\d+)\.\s*\*\*(.+?)\*\*(?:\s*\((\d{4}-\d{2}-\d{2})\))?$/);
  if (match) {
    const fullTitle = match[2].trim();
    const date = match[3] || '';
    const { vendorName, cleanTitle } = extractVendorFromTitle(fullTitle);
    return {
      title: fullTitle,
      cleanTitle: cleanTitle,
      vendorName: vendorName,
      priorityHint: null
    };
  }

  // 格式2：1. **标题** (不带【】)
  match = text.match(/^(\d+)\.\s*\*\*(.+?)\*\*(?:\s*\((\d{4}-\d{2}-\d{2})\))?$/);
  if (match) {
    return {
      title: match[2].trim(),
      cleanTitle: match[2].trim(),
      vendorName: null,
      priorityHint: null
    };
  }

  // 格式3：1. **标题** - 无日期
  match = text.match(/^(\d+)\.\s*\*\*(.+?)\*\*$/);
  if (match) {
    const fullTitle = match[2].trim();
    const { vendorName, cleanTitle } = extractVendorFromTitle(fullTitle);
    return {
      title: fullTitle,
      cleanTitle: cleanTitle,
      vendorName: vendorName,
      priorityHint: null
    };
  }

  // 格式4：- **标题** （列表项）
  match = text.match(/^-\s*\*\*(.+?)\*\*$/);
  if (match) {
    const fullTitle = match[1].trim();
    const { vendorName, cleanTitle } = extractVendorFromTitle(fullTitle);
    return {
      title: fullTitle,
      cleanTitle: cleanTitle,
      vendorName: vendorName,
      priorityHint: null
    };
  }

  return null;
}

/**
 * 从标题中提取厂商
 */
function extractVendorFromTitle(title) {
  const match = title.match(/【(.+?)】/);
  if (match) {
    const vendorName = match[1];
    const cleanTitle = title.replace(/【.+?】\s*/, '').trim();
    return { vendorName, cleanTitle };
  }
  return { vendorName: null, cleanTitle: title };
}

/**
 * 清理厂商名称
 */
function cleanVendorName(name) {
  if (!name) return '其他';
  return name
    .replace(/^[🔴🟠🟡🟢⚪]\s*/, '')
    .replace(/\s*[🔴🟠🟡🟢⚪]\s*$/, '')
    .replace(/【.+?】/g, '')
    .replace(/^\d+\.\s*/, '')
    .trim() || '其他';
}

function extractVendorId(vendorName) {
  if (!vendorName) return 'other';
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
  if (!text) return { level: 'other', name: '其他', color: '#1890FF', icon: '⚪' };
  if (text.includes('高优先') || text.includes('🔴')) {
    return { level: 'high', name: '高优先级', color: '#FF4D4F', icon: '🔴' };
  }
  if (text.includes('中优先') || text.includes('🟡')) {
    return { level: 'medium', name: '中优先级', color: '#FAAD14', icon: '🟡' };
  }
  if (text.includes('低优先') || text.includes('🟢')) {
    return { level: 'low', name: '低优先级', color: '#52C41A', icon: '🟢' };
  }
  return { level: 'other', name: '其他', color: '#1890FF', icon: '⚪' };
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
