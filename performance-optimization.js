// 页面性能优化脚本
// 为song-library.html页面提供性能优化的功能实现

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('性能优化脚本已加载');
    
    // 初始化数据缓存
    window.songDataCache = {};
    window.cacheTimestamp = 0;
    window.CACHE_DURATION = 30000; // 缓存30秒
    
    console.log('性能优化脚本已加载，但不会替换原始的loadSongs函数');
});

// 优化版的loadSongs函数
async function optimizedLoadSongs() {
    try {
        // 显示加载状态
        const songsContainer = document.getElementById('songs-container');
        songsContainer.innerHTML = '<div class="flex justify-center items-center col-span-full h-64"><i class="fa fa-circle-o-notch fa-spin text-3xl text-primary"></i></div>';

        // 构建请求参数
        const cacheKey = JSON.stringify({
            page: window.filterState.page,
            pageSize: window.filterState.pageSize,
            search: window.filterState.search,
            voicePart: window.filterState.voicePart,
            language: window.filterState.language,
            genre: window.filterState.genre,
            difficulty: window.filterState.difficulty,
            sort: window.filterState.sort
        });
        
        // 检查缓存是否有效
        const now = Date.now();
        const cachedData = window.songDataCache[cacheKey];
        
        if (cachedData && (now - window.cacheTimestamp < window.CACHE_DURATION)) {
            console.log('使用缓存数据，避免重复请求');
            renderSongData(cachedData);
            return;
        }
        
        console.log('缓存无效或已过期，请求新数据');

        // 使用明确的服务器地址，避免直接从文件系统访问时的问题
        // 使用与服务器相同的端口
    const port = window.location.port || '3004';
    const baseUrl = `http://localhost:${port}`;
        let url = `${baseUrl}/api/songs?page=${window.filterState.page}&pageSize=${window.filterState.pageSize}`;
        
        if (window.filterState.search) {
            url += `&search=${encodeURIComponent(window.filterState.search)}`;
        }
        
        // 添加三个分类的筛选条件
        if (window.filterState.voicePart !== 'all') {
            url += `&voicePart=${encodeURIComponent(window.filterState.voicePart)}`;
        }
        if (window.filterState.language !== 'all') {
            url += `&language=${encodeURIComponent(window.filterState.language)}`;
        }
        if (window.filterState.genre !== 'all') {
            url += `&genre=${encodeURIComponent(window.filterState.genre)}`;
        }
        
        // 添加难度筛选条件
        if (window.filterState.difficulty) {
            url += `&difficulty=${encodeURIComponent(window.filterState.difficulty)}`;
        }
        
        // 添加排序条件
        if (window.filterState.sort) {
            url += `&sort=${encodeURIComponent(window.filterState.sort)}`;
        }
        
        // 添加缓存控制头，指示服务器不要缓存动态内容
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/json'
            },
            credentials: 'include',
            signal: AbortSignal.timeout(10000) // 设置10秒超时
        };
        
        console.log('请求URL:', url);
        
        // 发送请求
        const startTime = performance.now();
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }
        
        const data = await response.json();
        const endTime = performance.now();
        
        console.log(`API请求完成，耗时: ${(endTime - startTime).toFixed(2)}ms`);
        
        // 更新缓存
        if (data.success) {
            window.songDataCache[cacheKey] = data;
            window.cacheTimestamp = now;
            
            // 限制缓存大小，防止内存泄漏
            const cacheKeys = Object.keys(window.songDataCache);
            if (cacheKeys.length > 20) {
                // 删除最早的缓存
                const oldestKey = cacheKeys[0];
                delete window.songDataCache[oldestKey];
                console.log('缓存大小超过限制，已删除最早的缓存项');
            }
        }
        
        // 渲染数据
        renderSongData(data);
        
    } catch (error) {
        console.error('加载曲目失败:', error);
        
        const songsContainer = document.getElementById('songs-container');
        let errorMessage = '网络连接失败，请检查您的网络设置后重试';
        
        // 处理请求中止错误
        if (error.name === 'AbortError') {
            errorMessage = '请求超时，请稍后再试';
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = '无法连接到服务器，请检查服务器是否正常运行';
        }
        
        songsContainer.innerHTML = `<div class="text-center text-gray-500 col-span-full py-12">${errorMessage}</div>`;
    }
}

// 渲染曲目数据的函数
function renderSongData(data) {
    try {
        const songsContainer = document.getElementById('songs-container');
        
        if (data.success && data.data && data.data.items) {
            // 使用文档片段减少DOM操作次数
            const fragment = document.createDocumentFragment();
            
            if (data.data.items.length > 0) {
                data.data.items.forEach(song => {
                    const songCard = document.createElement('div');
                    songCard.className = 'bg-white rounded-xl shadow-md overflow-hidden card-hover transition-all duration-300';
                    
                    // 使用模板字符串一次性构建HTML，减少多次appendChild操作
                    songCard.innerHTML = `
                        <div class="aspect-[4/3] overflow-hidden bg-gray-100 relative">
                            <img src="${song.imageUrl || 'https://via.placeholder.com/300x225?text=音乐'}" alt="${song.title}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">
                            <!-- 多标签显示区域 -->
                            <div class="absolute top-2 right-2 flex flex-col items-end gap-1.5">
                                <!-- 显示最多三个标签 -->
                                ${Array.isArray(song.tags) && song.tags.length > 0 ? 
                                    song.tags.slice(0, 3).map(tag => `
                                        <div class="bg-primary/80 text-white text-xs px-2 py-1 rounded-md shadow-sm">${tag}</div>
                                    `).join('') : 
                                    (function() {
                                        // 提供默认标签以确保始终显示标签
                                        let defaultTags = [];
                                        if (song.type) defaultTags.push(`<div class="bg-primary/80 text-white text-xs px-2 py-1 rounded-md shadow-sm">${song.type}</div>`);
                                        if (song.type2) defaultTags.push(`<div class="bg-primary/70 text-white text-xs px-2 py-1 rounded-md shadow-sm">${song.type2}</div>`);
                                        if (song.type3) defaultTags.push(`<div class="bg-primary/60 text-white text-xs px-2 py-1 rounded-md shadow-sm">${song.type3}</div>`);
                                                                                
                                        // 如果没有任何标签数据，提供默认标签
                                        if (defaultTags.length === 0) {
                                            defaultTags = [
                                                `<div class="bg-primary/80 text-white text-xs px-2 py-1 rounded-md shadow-sm">${song.genre || '未知体裁'}</div>`,
                                                `<div class="bg-primary/70 text-white text-xs px-2 py-1 rounded-md shadow-sm">${song.language || '未知语言'}</div>`,
                                                `<div class="bg-primary/60 text-white text-xs px-2 py-1 rounded-md shadow-sm">难度${song.difficulty || 3}</div>`
                                            ];
                                        }
                                                                                
                                        return defaultTags.join('');
                                    })()
                                }
                            </div>
                        </div>
                        <div class="p-5">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-xl font-bold text-gray-800 line-clamp-1">${song.title}</h3>
                                <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">${song.type || '未知类型'}</span>
                            </div>
                            <p class="text-gray-600 mb-3 line-clamp-1">${song.composer || '未知作曲家'}</p>
                            <div class="flex justify-between items-center">
                                <div class="flex items-center">
                                    ${generateDifficultyStars(song.difficulty || 1)}
                                </div>
                                <a href="song-detail.html?id=${song.id}" class="text-primary hover:text-dark transition-colors">
                                    查看详情 <i class="fa fa-angle-right ml-1"></i>
                                </a>
                            </div>
                        </div>
                    `;
                    
                    fragment.appendChild(songCard);
                });
            } else {
                const emptyState = document.createElement('div');
                emptyState.className = 'text-center text-gray-500 col-span-full py-12';
                emptyState.innerHTML = `
                    <i class="fa fa-search text-4xl mb-3"></i>
                    <p class="text-lg">没有找到符合条件的曲目</p>
                    <p class="text-sm mt-1">请尝试调整筛选条件</p>
                `;
                fragment.appendChild(emptyState);
            }
            
            // 一次性将文档片段添加到DOM
            songsContainer.innerHTML = '';
            songsContainer.appendChild(fragment);
            
            // 更新结果统计
            try {
                if (data.data && data.data.currentPage !== undefined && data.data.pageSize !== undefined && data.data.totalItems !== undefined) {
                    const startIndex = (data.data.currentPage - 1) * data.data.pageSize + 1;
                    const endIndex = Math.min(startIndex + data.data.pageSize - 1, data.data.totalItems);
                    document.getElementById('result-count').textContent = `显示: ${startIndex}-${endIndex}，共 ${data.data.totalItems} 首曲目`;
                } else {
                    // 使用filterState作为备选
                    const startIndex = (window.filterState.page - 1) * window.filterState.pageSize + 1;
                    const totalItems = data.data && data.data.totalItems ? data.data.totalItems : (data.data && data.data.items ? data.data.items.length : 0);
                    const endIndex = Math.min(startIndex + window.filterState.pageSize - 1, totalItems);
                    document.getElementById('result-count').textContent = `显示: ${startIndex}-${endIndex}，共 ${totalItems} 首曲目`;
                }
            } catch (summaryError) {
                console.error('结果统计更新错误:', summaryError);
            }
            
            // 生成分页控件
            try {
                if (data.data && data.data.totalPages !== undefined && data.data.currentPage !== undefined) {
                    renderPagination(data.data.totalPages, data.data.currentPage);
                } else {
                    // 使用filterState和总条目数计算总页数
                    const totalItems = data.data && data.data.totalItems ? data.data.totalItems : (data.data && data.data.items ? data.data.items.length : 0);
                    const totalPages = Math.ceil(totalItems / window.filterState.pageSize);
                    renderPagination(totalPages, window.filterState.page);
                }
            } catch (paginationError) {
                console.error('分页控件渲染错误:', paginationError);
            }
        } else {
            console.error('API返回失败:', data.message || '未知错误');
            songsContainer.innerHTML = '<div class="text-center text-gray-500 col-span-full py-12">加载失败，请稍后再试</div>';
        }
    } catch (renderError) {
        console.error('渲染数据时发生错误:', renderError);
        const songsContainer = document.getElementById('songs-container');
        songsContainer.innerHTML = '<div class="text-center text-gray-500 col-span-full py-12">数据渲染失败，请刷新页面重试</div>';
    }
}

// 生成分页控件的优化版函数
function renderPagination(totalPages, currentPage) {
    try {
        const paginationContainer = document.getElementById('pagination');
        
        // 如果只有一页，不显示分页控件
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        // 使用文档片段减少DOM操作
        const fragment = document.createDocumentFragment();
        
        // 上一页按钮
        const prevButton = document.createElement('button');
        prevButton.className = `px-4 py-2 rounded-lg mx-1 ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-primary border border-primary hover:bg-light'}`;
        prevButton.innerHTML = '<i class="fa fa-angle-left mr-1"></i> 上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                window.filterState.page = currentPage - 1;
                optimizedLoadSongs();
            }
        });
        fragment.appendChild(prevButton);
        
        // 页码按钮
        const showPages = [];
        
        if (totalPages <= 7) {
            // 总页数较少，显示所有页码
            for (let i = 1; i <= totalPages; i++) {
                showPages.push(i);
            }
        } else if (currentPage <= 4) {
            // 第一页到第四页，显示前7个页码
            for (let i = 1; i <= 5; i++) {
                showPages.push(i);
            }
            showPages.push('...', totalPages);
        } else if (currentPage >= totalPages - 3) {
            // 最后几页，显示后7个页码
            showPages.push(1, '...');
            for (let i = totalPages - 4; i <= totalPages; i++) {
                showPages.push(i);
            }
        } else {
            // 中间页码，显示当前页周围的页码
            showPages.push(1, '...');
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                showPages.push(i);
            }
            showPages.push('...', totalPages);
        }
        
        // 创建页码按钮
        showPages.forEach(page => {
            if (page === '...') {
                const dots = document.createElement('span');
                dots.className = 'px-4 py-2 text-gray-500';
                dots.textContent = '...';
                fragment.appendChild(dots);
            } else {
                const pageButton = document.createElement('button');
                pageButton.className = `px-4 py-2 rounded-lg mx-1 ${page === currentPage ? 'bg-primary text-white' : 'bg-white text-primary border border-primary hover:bg-light'}`;
                pageButton.textContent = page;
                pageButton.addEventListener('click', () => {
                    window.filterState.page = page;
                    optimizedLoadSongs();
                });
                fragment.appendChild(pageButton);
            }
        });
        
        // 下一页按钮
        const nextButton = document.createElement('button');
        nextButton.className = `px-4 py-2 rounded-lg mx-1 ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-primary border border-primary hover:bg-light'}`;
        nextButton.innerHTML = '下一页 <i class="fa fa-angle-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                window.filterState.page = currentPage + 1;
                optimizedLoadSongs();
            }
        });
        fragment.appendChild(nextButton);
        
        // 一次性替换原有内容
        paginationContainer.innerHTML = '';
        paginationContainer.appendChild(fragment);
        
    } catch (error) {
        console.error('渲染分页控件时发生错误:', error);
    }
}

// 生成难度星星的辅助函数
function generateDifficultyStars(difficulty) {
    let starsHtml = '';
    const numStars = parseInt(difficulty) || 1;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= numStars) {
            starsHtml += '<i class="fa fa-star text-yellow-400"></i>';
        } else {
            starsHtml += '<i class="fa fa-star-o text-gray-300"></i>';
        }
    }
    
    return starsHtml;
}

// 添加节流函数，防止频繁调用loadSongs
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 优化搜索框输入
function optimizeSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // 节流处理搜索输入
        const throttledSearch = throttle(function() {
            window.filterState.search = searchInput.value.trim();
            window.filterState.page = 1;
            optimizedLoadSongs();
        }, 500); // 500ms节流
        
        // 替换原有事件监听器
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', function() {
            if (this.value.trim() === '') {
                // 清空搜索时立即执行
                window.filterState.search = '';
                window.filterState.page = 1;
                optimizedLoadSongs();
            }
        });
        
        newSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                throttledSearch();
            }
        });
        
        // 添加延迟搜索
        let searchTimeout;
        newSearchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(throttledSearch, 800); // 800ms延迟
        });
    }
}

// 懒加载图片优化
function optimizeImageLoading() {
    // 检查是否支持IntersectionObserver
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        // 处理页面上的所有图片
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// 当DOM内容加载完成后执行额外的优化
setTimeout(() => {
    try {
        // 优化搜索输入
        optimizeSearchInput();
        
        // 优化图片加载
        optimizeImageLoading();
        
        // 优化筛选按钮点击事件
        document.querySelectorAll('.filter-btn').forEach(button => {
            const originalClick = button.onclick;
            if (originalClick) {
                button.onclick = function(e) {
                    originalClick.call(this, e);
                    // 可以在这里添加额外的优化逻辑
                };
            }
        });
        
        console.log('额外优化已应用');
    } catch (error) {
        console.error('应用额外优化时出错:', error);
    }
}, 1000);