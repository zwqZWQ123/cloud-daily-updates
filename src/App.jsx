import { useState, useEffect, useMemo } from 'react';
import { fetchDailyFiles, fetchDailyContent, cloudVendors } from './services/githubService';
import './App.css';

function App() {
  const [dailyFiles, setDailyFiles] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDailyFiles();
  }, []);

  const loadDailyFiles = async () => {
    setLoading(true);
    try {
      const files = await fetchDailyFiles();
      setDailyFiles(files);
      if (files.length > 0) {
        const latestDate = files[0].name.replace('.md', '');
        await loadDailyContent(latestDate);
      }
    } catch (err) {
      setError('加载数据失败，请稍后重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyContent = async (date) => {
    setLoading(true);
    try {
      setSelectedDate(date);
      const content = await fetchDailyContent(date);
      setSelectedContent(content);
    } catch (err) {
      setError('加载内容失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVendor = (vendorId) => {
    setSelectedVendors(prev => {
      return prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId];
    });
  };

  const filteredContent = useMemo(() => {
    if (!selectedContent) return null;

    const searchLower = searchTerm ? searchTerm.toLowerCase() : '';

    // 过滤厂商
    let filteredVendors = selectedContent.vendors;
    
    if (selectedVendors.length > 0) {
      filteredVendors = filteredVendors.filter(vendor => 
        selectedVendors.includes(vendor.id)
      );
    }

    // 搜索过滤
    if (searchLower) {
      filteredVendors = filteredVendors
        .map(vendor => {
          const vendorMatch = vendor.name.toLowerCase().includes(searchLower);
          if (vendorMatch) return vendor;

          const filteredItems = vendor.items.filter(item =>
            (item.title || '').toLowerCase().includes(searchLower) ||
            (item.cleanTitle || '').toLowerCase().includes(searchLower) ||
            (item.摘要 || '').toLowerCase().includes(searchLower) ||
            (item.type || '').toLowerCase().includes(searchLower) ||
            (item.影响范围 || '').toLowerCase().includes(searchLower)
          );

          return filteredItems.length > 0 ? { ...vendor, items: filteredItems } : null;
        })
        .filter(Boolean);
    }

    // 过滤告警
    let filteredAlerts = selectedContent.alerts;
    if (searchLower) {
      filteredAlerts = filteredAlerts.filter(alert =>
        (alert.vendor || '').toLowerCase().includes(searchLower) ||
        (alert.description || '').toLowerCase().includes(searchLower)
      );
    }

    return {
      ...selectedContent,
      vendors: filteredVendors,
      alerts: filteredAlerts
    };
  }, [selectedContent, selectedVendors, searchTerm]);

  const totalItems = useMemo(() => {
    if (!selectedContent) return 0;
    return selectedContent.vendors.reduce((sum, vendor) => sum + vendor.items.length, 0);
  }, [selectedContent]);

  const filteredItems = useMemo(() => {
    if (!filteredContent) return 0;
    return filteredContent.vendors.reduce((sum, vendor) => sum + vendor.items.length, 0);
  }, [filteredContent]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatFullDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getVendorColor = (vendorId) => {
    const vendor = cloudVendors.find(v => v.id === vendorId);
    return vendor ? vendor.color : '#666666';
  };

  const getVendorName = (vendorId) => {
    const vendor = cloudVendors.find(v => v.id === vendorId);
    return vendor ? vendor.name : vendorId;
  };

  // 获取域名的简化显示
  const getDomainFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">☁️ 云服务每日动态</h1>
          <p className="subtitle">五大公有云厂商动态信息展示 | AWS · Azure · 阿里云 · 腾讯云 · 华为云</p>
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h2 className="section-title">📅 日期选择</h2>
            <div className="date-list">
              {loading && dailyFiles.length === 0 ? (
                <div className="loading">加载中...</div>
              ) : dailyFiles.length === 0 ? (
                <div className="no-data">暂无数据</div>
              ) : (
                dailyFiles.map(file => {
                  const date = file.name.replace('.md', '');
                  return (
                    <button
                      key={date}
                      className={`date-item ${selectedDate === date ? 'active' : ''}`}
                      onClick={() => loadDailyContent(date)}
                    >
                      {formatDate(date)}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h2 className="section-title">☁️ 厂商筛选</h2>
            <div className="vendor-filter">
              {cloudVendors.map(vendor => (
                <label
                  key={vendor.id}
                  className={`vendor-checkbox-item ${selectedVendors.includes(vendor.id) ? 'active' : ''}`}
                  style={{ borderLeftColor: vendor.color }}
                >
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={() => toggleVendor(vendor.id)}
                  />
                  <span className="vendor-label">{vendor.name}</span>
                </label>
              ))}
            </div>
            {selectedVendors.length > 0 && (
              <button
                className="clear-filter-btn"
                onClick={() => setSelectedVendors([])}
              >
                清除筛选
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h2 className="section-title">📊 统计信息</h2>
            <div className="stats-info">
              <div className="stat-row">
                <span className="stat-label">当前日期:</span>
                <span className="stat-value">{selectedDate || '无'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">筛选厂商:</span>
                <span className="stat-value">
                  {selectedVendors.length > 0 
                    ? selectedVendors.map(id => getVendorName(id)).join(', ') 
                    : '全部'}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">搜索词:</span>
                <span className="stat-value">{searchTerm || '无'}</span>
              </div>
              <div className="stat-row highlight">
                <span className="stat-label">总动态数:</span>
                <span className="stat-value">{totalItems}</span>
              </div>
              <div className="stat-row highlight">
                <span className="stat-label">筛选后:</span>
                <span className="stat-value">{filteredItems}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="content">
          <div className="search-bar">
            <input
              type="text"
              placeholder="搜索动态内容、厂商、类型..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>加载中...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p>❌ {error}</p>
              <button onClick={loadDailyFiles} className="retry-btn">
                重试
              </button>
            </div>
          ) : filteredContent ? (
            <div className="daily-content">
              {/* 活跃告警 */}
              {filteredContent.alerts && filteredContent.alerts.length > 0 && (
                <div className="alerts-section">
                  <h2 className="section-header">
                    <span className="alert-icon">🚨</span>
                    活跃告警
                  </h2>
                  <div className="alerts-list">
                    {filteredContent.alerts.map((alert, index) => (
                      <div key={index} className="alert-card">
                        <div className="alert-vendor">
                          <span className="alert-icon-inline">{alert.icon}</span>
                          <strong>【{alert.vendor}】</strong>
                        </div>
                        <div className="alert-description">
                          {alert.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 今日概览 */}
              <div className="overview-section">
                <h2 className="section-header">📊 今日概览</h2>
                <div className="overview-stats">
                  <div className="stat-card total">
                    <div className="stat-number">{filteredContent.overview.total}</div>
                    <div className="stat-name">总采集数</div>
                  </div>
                  <div className="stat-card high">
                    <div className="stat-number">{filteredContent.overview.high}</div>
                    <div className="stat-name">🔴 高优先级</div>
                  </div>
                  <div className="stat-card medium">
                    <div className="stat-number">{filteredContent.overview.medium}</div>
                    <div className="stat-name">🟡 中优先级</div>
                  </div>
                  <div className="stat-card low">
                    <div className="stat-number">{filteredContent.overview.low}</div>
                    <div className="stat-name">🟢 低优先级</div>
                  </div>
                </div>
              </div>

              {/* 数据采集说明 */}
              {filteredContent.采集说明 && filteredContent.采集说明.length > 0 && (
                <div className="collection-section">
                  <h2 className="section-header">⚠️ 数据采集说明</h2>
                  <div className="collection-list">
                    {filteredContent.采集说明.map((item, index) => (
                      <div key={index} className="collection-item" 
                        dangerouslySetInnerHTML={{ __html: formatCollectionItem(item) }} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 内容标题 */}
              <div className="content-header">
                <h2 className="content-title">
                  {formatFullDate(filteredContent.date)}
                </h2>
                {filteredContent.采集时间 && (
                  <div className="meta-info">
                    <span className="meta-badge">⏰ 采集时间：{filteredContent.采集时间}</span>
                  </div>
                )}
                {filteredContent.来源 && (
                  <div className="meta-info">
                    <span className="meta-badge">📡 来源：{filteredContent.来源}</span>
                  </div>
                )}
              </div>

              {/* 筛选结果提示 */}
              {(searchTerm || selectedVendors.length > 0) && (
                <div className="filter-info">
                  <span>筛选结果: </span>
                  <strong>{filteredContent.vendors.length} 个厂商</strong>
                  <span>, </span>
                  <strong>{filteredItems} 条动态</strong>
                  <button
                    className="clear-all-btn"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedVendors([]);
                    }}
                  >
                    清除全部筛选
                  </button>
                </div>
              )}

              {/* 动态列表 */}
              {filteredContent.vendors.length === 0 ? (
                <div className="no-results">
                  <p>没有找到匹配的内容</p>
                </div>
              ) : (
                <div className="vendors-list">
                  {filteredContent.vendors.map((vendor, vendorIndex) => (
                    <div
                      key={`vendor-${vendorIndex}`}
                      className="vendor-card"
                      style={{ borderTopColor: getVendorColor(vendor.id) }}
                    >
                      <div className="vendor-header">
                        <h3
                          className="vendor-name"
                          style={{ color: getVendorColor(vendor.id) }}
                        >
                          ☁️ {vendor.name}
                        </h3>
                        <span className="vendor-count">
                          {vendor.items.length} 条动态
                        </span>
                      </div>

                      {vendor.note && (
                        <div className="vendor-note">
                          💡 {vendor.note}
                        </div>
                      )}

                      <div className="items-list">
                        {vendor.items.map((item, itemIndex) => (
                          <div
                            key={`item-${itemIndex}`}
                            className={`item-card ${item.isExtended ? 'extended' : ''}`}
                            style={{ borderLeftColor: item.priority?.color || '#666' }}
                          >
                            <div className="item-header">
                              <span
                                className="priority-badge"
                                style={{
                                  backgroundColor: item.priority?.color || '#666',
                                  color: '#fff'
                                }}
                              >
                                {item.priority?.icon || '⚪'} {item.priority?.name || '其他'}
                              </span>
                              {item.isExtended && (
                                <span className="extended-badge">⏰ 延续</span>
                              )}
                            </div>

                            <h4 className="item-title">
                              {item.cleanTitle || item.title}
                            </h4>

                            <div className="item-fields">
                              {item.type && (
                                <div className="item-field">
                                  <span className="field-label">📋 类型</span>
                                  <span className="field-value">{item.type}</span>
                                </div>
                              )}

                              {item.摘要 && (
                                <div className="item-field summary-field">
                                  <span className="field-label">📝 摘要</span>
                                  <span className="field-value">{item.摘要}</span>
                                </div>
                              )}

                              {item.详情 && (
                                <div className="item-field summary-field">
                                  <span className="field-label">📝 详情</span>
                                  <span className="field-value">{item.详情}</span>
                                </div>
                              )}

                              {item.影响范围 && (
                                <div className="item-field">
                                  <span className="field-label">🎯 影响范围</span>
                                  <span className="field-value">{item.影响范围}</span>
                                </div>
                              )}

                              {item.日期 && (
                                <div className="item-field">
                                  <span className="field-label">📅 日期</span>
                                  <span className="field-value">{item.日期}</span>
                                </div>
                              )}

                              {item.紧急程度 && (
                                <div className="item-field">
                                  <span className="field-label">⚠️ 紧急程度</span>
                                  <span className="field-value urgency">{item.紧急程度}</span>
                                </div>
                              )}
                            </div>

                            {item.来源 && (
                              <a
                                href={item.来源}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                <span className="source-icon">🔗</span>
                                <span className="source-text">
                                  {item.来源标题 ? '查看详情' : '查看来源'}
                                </span>
                                {item.来源标题 && (
                                  <span className="source-title" title={item.来源标题}>
                                    {item.来源标题.length > 30 
                                      ? item.来源标题.substring(0, 30) + '...' 
                                      : item.来源标题}
                                  </span>
                                )}
                                {!item.来源标题 && (
                                  <span className="source-domain">{getDomainFromUrl(item.来源)}</span>
                                )}
                                <span className="source-arrow">→</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 其他动态区域 */}
              {filteredContent.其他动态 && filteredContent.其他动态.length > 0 && (
                <div className="other-section">
                  <h2 className="section-header">📝 其他动态</h2>
                  <div className="other-list">
                    {filteredContent.其他动态.map((item, index) => (
                      <div key={index} className="other-item">
                        {item.vendor && item.vendor !== '其他' && (
                          <span className="other-vendor">【{item.vendor}】</span>
                        )}
                        <span className="other-text">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 最近7日动态回顾 */}
              {filteredContent.recent7Days && filteredContent.recent7Days.length > 0 && (
                <div className="recent7days-section">
                  <h2 className="section-header">📅 最近7日动态回顾</h2>
                  <div className="table-container">
                    <table className="recent-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>AWS</th>
                          <th>Azure</th>
                          <th>阿里云</th>
                          <th>腾讯云</th>
                          <th>华为云</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContent.recent7Days.map((row, index) => (
                          <tr key={index}>
                            <td className="date-cell">{row.date}</td>
                            <td className="vendor-cell">{row.aws}</td>
                            <td className="vendor-cell">{row.azure}</td>
                            <td className="vendor-cell">{row.aliyun}</td>
                            <td className="vendor-cell">{row.tencent}</td>
                            <td className="vendor-cell">{row.huawei}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>请选择一个日期查看动态</p>
            </div>
          )}
        </main>
      </div>

      <footer className="footer">
        <p>
          数据来源: 
          <a
            href="https://github.com/zwqZWQ123/cloud-intel"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub 仓库
          </a>
          <span className="divider">|</span>
          <span>自动采集生成</span>
        </p>
      </footer>
    </div>
  );
}

// 格式化采集说明项
function formatCollectionItem(text) {
  // 将 **xxx**: yyy 格式转换为HTML
  return text.replace(/\*\*([^*]+)\*\*[：:]\s*([^*\n]+)/g, 
    '<strong>$1</strong>: <span>$2</span>'
  );
}

export default App;
