document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const triggerXLSXModalBtn = document.getElementById('triggerXLSXModalBtn');
    const xlsxModal = document.getElementById('xlsxModal');
    const confirmXLSXBtn = document.getElementById('confirmXLSXBtn');
    const cancelXLSXBtn = document.getElementById('cancelXLSXBtn');
    const templateSelectForXLSX = document.getElementById('templateSelectForXLSX');
    const templateSelect = document.getElementById('templateSelect');
    const articleSelect = document.getElementById('articleSelect');
    const urlList = document.getElementById('urlList');
    const archiveTitle = document.getElementById('archiveTitle');
    const bulkActions = document.getElementById('bulkActions');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyAllListBtn = document.getElementById('copyAllListBtn');
    const showAllBtn = document.getElementById('showAllBtn');

    // Данные и состояние
    let articleData = {};

    // Инициализация приложения
    initArchive();

    function initArchive() {
        initTheme();
        processImageData();
        initEventListeners();
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
        } else {
            themeToggle.textContent = '🌙';
        }

        themeToggle.addEventListener('click', toggleTheme);
    }

    function toggleTheme() {
        body.classList.toggle('dark-theme');
        if (body.classList.contains('dark-theme')) {
            themeToggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            themeToggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
    }

    function processImageData() {
        if (imageData && Array.isArray(imageData)) {
            imageData.forEach(item => {
                const template = item.template;
                const article = item.article;

                if (!articleData[template]) {
                    articleData[template] = {};
                }
                if (!articleData[template][article]) {
                    articleData[template][article] = [];
                }

                articleData[template][article].push({
                    url: item.url,
                    filename: item.filename,
                    thumbnail_url: item.thumbnail_url
                });
            });

            // Сортировка данных
            Object.keys(articleData).forEach(template => {
                const sortedArticles = {};
                Object.keys(articleData[template]).sort().forEach(article => {
                    sortedArticles[article] = articleData[template][article].sort((a, b) =>
                        a.filename.localeCompare(b.filename)
                    );
                });
                articleData[template] = sortedArticles;
            });

            populateTemplateList();
        }
    }

    function populateTemplateList() {
        templateSelect.innerHTML = '<option value="">-- Выберите шаблон --</option>';
        Object.keys(articleData).forEach(templateName => {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            templateSelect.appendChild(option);
        });
    }

    function populateArticleList(templateName) {
        if (!templateName || !articleData[templateName]) {
            articleSelect.innerHTML = '<option value="">-- Выберите артикул --</option>';
            articleSelect.disabled = true;
            return;
        }

        articleSelect.innerHTML = '<option value="">-- Выберите артикул --</option>';
        Object.keys(articleData[templateName]).forEach(articleName => {
            const option = document.createElement('option');
            option.value = articleName;
            option.textContent = articleName;
            articleSelect.appendChild(option);
        });
        articleSelect.disabled = false;
    }

    function displayArticleUrls(templateName, articleName) {
        if (!templateName || !articleName || !articleData[templateName] || !articleData[templateName][articleName]) {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Артикул не найден';
            bulkActions.style.display = 'none';
            return;
        }

        const urls = articleData[templateName][articleName];
        archiveTitle.textContent = `Артикул: ${articleName}`;
        urlList.innerHTML = '';

        urls.forEach(item => {
            const urlItem = createUrlItem(item, articleName, templateName);
            urlList.appendChild(urlItem);
        });

        bulkActions.style.display = 'flex';
    }

    function displayAllUrls() {
        urlList.innerHTML = '';
        archiveTitle.textContent = 'Все ссылки';

        const groupedUrls = {};
        if (imageData && Array.isArray(imageData)) {
            imageData.forEach(item => {
                if (!groupedUrls[item.article]) {
                    groupedUrls[item.article] = [];
                }
                groupedUrls[item.article].push(item);
            });
        }

        Object.entries(groupedUrls).forEach(([articleName, items]) => {
            const articleHeader = document.createElement('div');
            articleHeader.className = 'article-info';
            articleHeader.textContent = `Шаблон: ${items[0].template}, Артикул: ${articleName}`;
            urlList.appendChild(articleHeader);

            items.forEach(item => {
                const urlItem = createUrlItem(item, articleName, item.template);
                urlList.appendChild(urlItem);
            });
        });

        bulkActions.style.display = 'flex';
    }

    function createUrlItem(item, articleName, templateName) {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';
        urlItem.innerHTML = `
            <div class="preview-container">
                <img
                    src="${item.thumbnail_url || item.url}"
                    alt="Preview ${item.filename}"
                    class="image-preview"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='${item.url}';"
                >
            </div>
            <div class="url-content">
                <div class="url-text" data-url="${item.url}">
                    ${item.url}
                    <span class="copy-hint">🔗 Кликните чтобы скопировать</span>
                </div>
                <small style="color: var(--label-color); margin-top: 5px; display: block;">${item.filename}</small>
            </div>
            <button class="delete-btn" data-url="${item.url}" title="Удалить изображение и файлы">
                🗑️
            </button>
        `;
        return urlItem;
    }

    function initEventListeners() {
        // Селекты
        templateSelect.addEventListener('change', handleTemplateChange);
        articleSelect.addEventListener('change', handleArticleChange);
        showAllBtn.addEventListener('click', displayAllUrls);

        // Модальное окно XLSX
        if (triggerXLSXModalBtn) {
            triggerXLSXModalBtn.addEventListener('click', () => xlsxModal.style.display = 'block');
        }
        if (confirmXLSXBtn) {
            confirmXLSXBtn.addEventListener('click', handleXLSXGeneration);
        }
        if (cancelXLSXBtn) {
            cancelXLSXBtn.addEventListener('click', closeXLSXModal);
        }

        // Кнопки копирования
        if (copyAllBtn) copyAllBtn.addEventListener('click', copyAllToClipboard);
        if (copyAllListBtn) copyAllListBtn.addEventListener('click', copyAllListToClipboard);

        // Общие обработчики
        document.addEventListener('click', handleUrlClick);
        document.addEventListener('click', handleDeleteClick);
        window.addEventListener('click', handleWindowClick);
    }

    function handleTemplateChange() {
        const selectedTemplate = this.value;
        populateArticleList(selectedTemplate);

        if (!selectedTemplate) {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Выберите артикул';
            bulkActions.style.display = 'none';
        }
    }

    function handleArticleChange() {
        const selectedTemplate = templateSelect.value;
        const selectedArticle = this.value;

        if (selectedTemplate && selectedArticle) {
            displayArticleUrls(selectedTemplate, selectedArticle);
        } else {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Выберите артикул';
            bulkActions.style.display = 'none';
        }
    }

    function closeXLSXModal() {
        xlsxModal.style.display = 'none';
        templateSelectForXLSX.value = '';
    }

    function handleXLSXGeneration() {
        const selectedTemplate = templateSelectForXLSX.value;
        if (selectedTemplate) {
            closeXLSXModal();
            downloadXLSXDocument(selectedTemplate);
        } else {
            showNotification('Пожалуйста, выберите шаблон.', 'error');
        }
    }

    function handleWindowClick(event) {
        if (event.target === xlsxModal) closeXLSXModal();
    }

    function showNotification(message, type = 'success') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: var(--${type === 'success' ? 'notification-success' : 'notification-error'});
            color: white;
            border-radius: 5px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Ссылка скопирована в буфер обмена!');
            }).catch(err => {
                console.error('Ошибка Clipboard API:', err);
                fallbackCopyTextToClipboard(text);
            });
        } else {
            fallbackCopyTextToClipboard(text);
        }
    }

    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 2em;
            height: 2em;
            padding: 0;
            border: none;
            outline: none;
            boxShadow: none;
            background: transparent;
            color: transparent;
        `;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showNotification('Ссылка скопирована в буфер обмена!');
            } else {
                showNotification('Не удалось скопировать ссылку', 'error');
            }
        } catch (err) {
            console.error('Ошибка при копировании execCommand: ', err);
            showNotification('Ошибка копирования', 'error');
        }
        document.body.removeChild(textArea);
    }

    function copyAllToClipboard() {
        const urlItems = document.querySelectorAll('#urlList .url-text');
        if (!urlItems.length) {
            showNotification('Нет ссылок для копирования', 'error');
            return;
        }

        const allUrls = Array.from(urlItems).map(item => item.getAttribute('data-url')).join(', ');
        copyToClipboard(allUrls);
    }

    function copyAllListToClipboard() {
        const urlItems = document.querySelectorAll('#urlList .url-text');
        if (!urlItems.length) {
            showNotification('Нет ссылок для копирования', 'error');
            return;
        }

        const allUrls = Array.from(urlItems)
            .map(item => item.getAttribute('data-url'))
            .join('\n');
        copyToClipboard(allUrls);
    }

    function handleUrlClick(e) {
        if (e.target.classList.contains('url-text')) {
            if (e.target.querySelector('.copy-hint') === e.target) return;

            const url = e.target.getAttribute('data-url');
            if (url) {
                copyToClipboard(url);
                e.target.classList.add('copied');
                setTimeout(() => e.target.classList.remove('copied'), 2000);
            }
        }
    }

    function downloadXLSXDocument(selectedTemplateName) {
        const urlItems = document.querySelectorAll('#urlList .url-item');
        if (!urlItems.length) {
            showNotification('Нет ссылок для генерации документа', 'error');
            return;
        }

        const imageDataToSend = [];
        urlItems.forEach(itemElement => {
            const articleElement = itemElement.querySelector('.article-info');
            const urlElement = itemElement.querySelector('.url-text');
            let article = '';

            if (articleElement) {
                const text = articleElement.textContent;
                const match = text.match(/Артикул: ([^,]+)/);
                if (match) {
                    article = match[1].trim();
                }
            } else {
                article = archiveTitle.textContent.replace('Артикул: ', '').trim();
            }

            if (urlElement) {
                imageDataToSend.push({
                    url: urlElement.getAttribute('data-url'),
                    article: article,
                    filename: urlElement.getAttribute('data-url').split('/').pop()
                });
            }
        });

        if (!selectedTemplateName.trim()) {
            showNotification('Имя шаблона пустое. Невозможно выбрать шаблон.', 'error');
            return;
        }

        showNotification('Генерация XLSX документа для шаблона: ' + selectedTemplateName, 'success');

        fetch('/admin/download-xlsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: imageDataToSend,
                template_name: selectedTemplateName
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Ошибка сервера') });
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            a.download = `${selectedTemplateName}_catalog_${timestamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('XLSX документ успешно сгенерирован и скачан!', 'success');
        })
        .catch(error => {
            console.error('Ошибка при генерации XLSX:', error);
            showNotification('Ошибка при генерации XLSX: ' + error.message, 'error');
        });
    }

    function deleteImage(imageUrl, urlItemElement) {
        if (!confirm('Вы уверены, что хотите удалить это изображение? Файлы и миниатюры будут удалены безвозвратно.')) {
            return;
        }

        const deleteBtn = urlItemElement.querySelector('.delete-btn');
        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '⏳';
        deleteBtn.disabled = true;

        fetch('/admin/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: imageUrl })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                urlItemElement.remove();
                showNotification('Изображение и файлы успешно удалены', 'success');

                const remainingItems = document.querySelectorAll('.url-item');
                if (remainingItems.length === 0) {
                    setTimeout(() => window.location.reload(), 1000);
                }
            } else {
                throw new Error(data.error || 'Ошибка при удалении');
            }
        })
        .catch(error => {
            console.error('Ошибка при удалении изображения:', error);
            showNotification('Ошибка при удалении: ' + error.message, 'error');
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
        });
    }

    function handleDeleteClick(e) {
        if (e.target.classList.contains('delete-btn')) {
            const imageUrl = e.target.getAttribute('data-url');
            const urlItem = e.target.closest('.url-item');
            if (imageUrl && urlItem) {
                deleteImage(imageUrl, urlItem);
            }
        }
    }
});
