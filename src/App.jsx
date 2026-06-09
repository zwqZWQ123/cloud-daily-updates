import { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
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
      const newVendors = prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId];
      return newVendors;
    });
  };

  const filteredSections = useMemo(() => {
    if (!selectedContent || !selectedContent.sections) {
      return [];
    }

    const searchLower = searchTerm ? searchTerm.toLowerCase() : '';

    return selectedContent.sections
      .filter(section => {
        if (selectedVendors.length > 0 && !selectedVendors.includes(section.vendorId)) {
          return false;
        }

        if (!searchLower) {
          return true;
        }

        const vendorMatch = section.vendor.toLowerCase().includes(searchLower);
        const hasMatchingItem = section.items.some(item => 
          item.title.toLowerCase().includes(searchLower) ||
          item.cleanTitle.toLowerCase().includes(searchLower) ||
          item.content.toLowerCase().includes(searchLower)
        );

        return vendorMatch || hasMatchingItem;
      })
      .map(section => {
        if (!searchLower) {
          return section;
        }

        const vendorMatch = section.vendor.toLowerCase().includes(searchLower);
        
        if (vendorMatch) {
          return section;
        }

        const matchingItems = section.items.filter(item => 
          item.title.toLowerCase().includes(searchLower) ||
          item.cleanTitle.toLowerCase().includes(searchLower) ||
          item.content.toLowerCase().includes(searchLower)
        );

        return {
          ...section,
          items: matchingItems
        };
      })
      .filter(section => section.items.length > 0);
  }, [selectedContent, selectedVendors, searchTerm]);

  const totalItems = useMemo(() => {
    if (!selectedContent || !selectedContent.sections) {
      return 0;
    }
    return selectedContent.sections.reduce((sum, section) => sum + section.items.length, 0);
  }, [selectedContent]);

  const filteredItems = useMemo(() => {
    return filteredSections.reduce((sum, section) => sum + section.items.length, 0);
  }, [filteredSections]);

  const formatDate = (dateStr) => {
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">云服务动态</h1>
          <p className="subtitle">5家公有云每日动态信息展示</p>
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h2 className="section-title">日期选择</h2>
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
            <h2 className="section-title">厂商筛选</h2>
            <div className="vendor-list">
              {cloudVendors.map(vendor => (
                <label
                  key={vendor.id}
                  className={`vendor-item ${selectedVendors.includes(vendor.id) ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={() => toggleVendor(vendor.id)}
                    className="vendor-checkbox"
                  />
                  <span
                    className="vendor-color"
                    style={{ backgroundColor: vendor.color }}
                  ></span>
                  <span className="vendor-name">{vendor.name}</span>
                </label>
              ))}
            </div>
            {selectedVendors.length > 0 && (
              <button
                className="clear-filter"
                onClick={() => setSelectedVendors([])}
              >
                清除筛选
              </button>
            )}
          </div>

          <div className="sidebar-section debug-info">
            <h2 className="section-title">统计信息</h2>
            <div className="debug-content">
              <p><strong>当前日期:</strong> {selectedDate || '无'}</p>
              <p><strong>选中厂商:</strong> {selectedVendors.length > 0 ? selectedVendors.join(', ') : '全部'}</p>
              <p><strong>搜索词:</strong> {searchTerm || '无'}</p>
              <p><strong>总厂商数:</strong> {selectedContent?.sections?.length || 0}</p>
              <p><strong>总动态数:</strong> {totalItems}</p>
              <p><strong>筛选后厂商:</strong> {filteredSections.length}</p>
              <p><strong>筛选后动态:</strong> {filteredItems}</p>
            </div>
          </div>
        </aside>

        <main className="content">
          <div className="search-bar">
            <input
              type="text"
              placeholder="搜索动态内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                className="clear-search"
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
            <div className="error-message">
              <p>{error}</p>
              <button onClick={loadDailyFiles} className="retry-button">
                重试
              </button>
            </div>
          ) : selectedContent ? (
            <div className="daily-content">
              <div className="content-header">
                <h2 className="content-title">
                  {formatDate(selectedContent.date)}
                </h2>
                <div className="stats">
                  <span>共 {selectedContent.sections.length} 个厂商，{totalItems} 条动态</span>
                  {(searchTerm || selectedVendors.length > 0) && (
                    <span className="search-result">
                      筛选结果: {filteredSections.length} 个厂商，{filteredItems} 条动态
                    </span>
                  )}
                </div>
              </div>

              {filteredSections.length === 0 ? (
                <div className="no-results">
                  <p>没有找到匹配的内容</p>
                  {selectedVendors.length > 0 && (
                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
                      已选中厂商: {selectedVendors.map(id => {
                        const vendor = cloudVendors.find(v => v.id === id);
                        return vendor ? vendor.name : id;
                      }).join(', ')}
                    </p>
                  )}
                  {searchTerm && (
                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
                      搜索词: "{searchTerm}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="sections">
                  {filteredSections.map((section, sectionIndex) => (
                    <div
                      key={`section-${sectionIndex}`}
                      className="vendor-section"
                      style={{ borderLeftColor: getVendorColor(section.vendorId) }}
                    >
                      <h3
                        className="vendor-title"
                        style={{ color: getVendorColor(section.vendorId) }}
                      >
                        {section.vendor}
                        <span className="item-count">
                          ({section.items.length} 条动态)
                        </span>
                      </h3>
                      
                      <div className="items">
                        {section.items.map((item, itemIndex) => (
                          <div 
                            key={`item-${itemIndex}`} 
                            className="item"
                            style={{ borderTopColor: item.priority.color }}
                          >
                            <div className="item-header">
                              <span 
                                className="priority-badge"
                                style={{ backgroundColor: item.priority.color }}
                              >
                                {item.priority.name}
                              </span>
                              <h4 className="item-title">{item.cleanTitle}</h4>
                            </div>
                            <div
                              className="item-content markdown-content"
                              dangerouslySetInnerHTML={{
                                __html: marked(item.content)
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
          数据来源: <a
            href="https://github.com/zwqZWQ123/cloud-intel"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub仓库
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
