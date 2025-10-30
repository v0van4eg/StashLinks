document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const triggerXLSXModalBtn = document.getElementById('triggerXLSXModalBtn');
    const xlsxModal = document.getElementById('xlsxModal');
    const confirmXLSXBtn = document.getElementById('confirmXLSXBtn');
    const cancelXLSXBtn = document.getElementById('cancelXLSXBtn');
    const templateSelectForXLSX = document.getElementById('templateSelectForXLSX');
    const separatorSection = document.getElementById('separatorSection');
    const separatorSelect = document.getElementById('separatorSelect');
    const templateSelect = document.getElementById('templateSelect');
    const articleSelect = document.getElementById('articleSelect');
    const urlList = document.getElementById('urlList');
    const archiveTitle = document.getElementById('archiveTitle');
    const bulkActions = document.getElementById('bulkActions');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyAllListBtn = document.getElementById('copyAllListBtn');
    const showAllBtn = document.getElementById('showAllBtn');

    // Элементы модального окна изображений
    const imageModal = document.getElementById('imageModal');
    const imageModalImg = document.getElementById('imageModalImg');
    const imageModalClose = document.getElementById('imageModalClose');
    const imageModalPrev = document.getElementById('imageModalPrev');
    const imageModalNext = document.getElementById('imageModalNext');
    const imageModalFilename = document.getElementById('imageModalFilename');
    const imageModalUrl = document.getElementById('imageModalUrl');

    // Переменные для навигации по изображениям
    let currentImageIndex = 0;
    let allImages = [];

    // Данные и состояние
    let articleData = {};
    let currentTemplate = '';
    let currentArticle = '';

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
            // Сначала сортируем все данные
            const sortedImageData = [...imageData].sort((a, b) => {
                // Сортировка по шаблону
                if (a.template < b.template) return -1;
                if (a.template > b.template) return 1;

                // Затем по артикулу
                if (a.article < b.article) return -1;
                if (a.article > b.article) return 1;

                // Затем по порядковому номеру из имени файла
                const matchA = a.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);
                const matchB = b.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);

                const numA = matchA ? parseInt(matchA[1], 10) : 0;
                const numB = matchB ? parseInt(matchB[1], 10) : 0;

                return numA - numB;
            });

            // Теперь группируем отсортированные данные
            sortedImageData.forEach(item => {
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

            // Дополнительная сортировка внутри каждого артикула
            Object.keys(articleData).forEach(template => {
                Object.keys(articleData[template]).forEach(article => {
                    articleData[template][article].sort((a, b) => {
                        const matchA = a.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);
                        const matchB = b.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);

                        const numA = matchA ? parseInt(matchA[1], 10) : 0;
                        const numB = matchB ? parseInt(matchB[1], 10) : 0;

                        return numA - numB;
                    });
                });
            });

            populateTemplateList();
        }
    }

    function populateTemplateList() {
        templateSelect.innerHTML = '<option value="">-- Выберите альбом --</option>';
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

        articleSelect.innerHTML = '<option value="">-- Все артикулы --</option>';
        Object.keys(articleData[templateName]).forEach(articleName => {
            const option = document.createElement('option');
            option.value = articleName;
            option.textContent = articleName;
            articleSelect.appendChild(option);
        });
        articleSelect.disabled = false;
    }

    // НОВАЯ ФУНКЦИЯ: Отображение всех ссылок выбранного каталога
    function displayTemplateUrls(templateName) {
        if (!templateName || !articleData[templateName]) {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Каталог не найден';
            bulkActions.style.display = 'none';
            return;
        }

        const urlsByArticle = articleData[templateName];
        archiveTitle.textContent = `Альбом: ${templateName} (все артикулы)`;
        urlList.innerHTML = '';

        // Проходим по всем артикулам в каталоге
        Object.entries(urlsByArticle).forEach(([articleName, items]) => {
            // Добавляем заголовок артикула
            const articleHeader = document.createElement('div');
            articleHeader.className = 'article-info';
            articleHeader.textContent = `Артикул: ${articleName}`;
            urlList.appendChild(articleHeader);

            // Добавляем каждое изображение артикула
            items.forEach(item => {
                const urlItem = createUrlItem(item, articleName, templateName);
                urlList.appendChild(urlItem);
            });
        });

        bulkActions.style.display = 'flex';
    }

    // ИЗМЕНЕННАЯ ФУНКЦИЯ: Теперь отображает либо все артикулы каталога, либо конкретный артикул
    function displayUrls(templateName, articleName = '') {
        if (!templateName || !articleData[templateName]) {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Каталог не найден';
            bulkActions.style.display = 'none';
            return;
        }

        if (articleName && articleData[templateName][articleName]) {
            // Показать только выбранный артикул
            const urls = articleData[templateName][articleName];
            archiveTitle.textContent = `Альбом: ${templateName}, Артикул: ${articleName}`;
            urlList.innerHTML = '';

            urls.forEach(item => {
                const urlItem = createUrlItem(item, articleName, templateName);
                urlList.appendChild(urlItem);
            });
        } else {
            // Показать все артикулы каталога
            displayTemplateUrls(templateName);
        }

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

        // Сбросить выбранные значения
        templateSelect.value = '';
        articleSelect.value = '';
        articleSelect.disabled = true;
        currentTemplate = '';
        currentArticle = '';
    }

    function createUrlItem(item, articleName, templateName) {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';
        urlItem.setAttribute('data-article', articleName);
        urlItem.setAttribute('data-template', templateName);
        urlItem.innerHTML = `
            <div class="preview-container">
                <img
                    src="${item.thumbnail_url || item.url}"
                    alt="Preview ${item.filename}"
                    class="image-preview"
                    loading="lazy"
                    data-original-src="${item.url}"
                    data-filename="${item.filename}"
                    onerror="this.onerror=null; this.src='${item.url}';"
                >
            </div>
            <div class="url-content">
                <span class="article-info">Артикул: ${articleName}</span>
                <div class="url-text" data-url="${item.url}">
                    ${item.url}
                    <span class="copy-hint">🔗 Кликните чтобы скопировать</span>
                </div>
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

        // Обработчик изменения выбора шаблона в модальном окне
        if (templateSelectForXLSX) {
            templateSelectForXLSX.addEventListener('change', function() {
                if (this.value === 'В ячейку') {
                    separatorSection.style.display = 'block';
                } else {
                    separatorSection.style.display = 'none';
                }
            });
        }

        // Кнопки копирования
        if (copyAllBtn) copyAllBtn.addEventListener('click', copyAllToClipboard);
        if (copyAllListBtn) copyAllListBtn.addEventListener('click', copyAllListToClipboard);

        // Клик по превью изображений
        document.addEventListener('click', handleImagePreviewClick);

        // Общие обработчики
        document.addEventListener('click', handleUrlClick);
        document.addEventListener('click', handleDeleteClick);
        window.addEventListener('click', handleWindowClick);

        // Обработчики для модального окна изображений
        if (imageModalClose) {
            imageModalClose.addEventListener('click', closeImageModal);
        }
        if (imageModalPrev) {
            imageModalPrev.addEventListener('click', showPrevImage);
        }
        if (imageModalNext) {
            imageModalNext.addEventListener('click', showNextImage);
        }

        // Навигация по клавиатуре
        document.addEventListener('keydown', handleKeyboardNavigation);
    }

    // Функции для модального окна изображений
    function openImageModal(imageIndex) {
        if (!allImages.length) return;

        currentImageIndex = imageIndex;
        const image = allImages[currentImageIndex];

        imageModalImg.src = image.originalSrc;
        imageModalFilename.textContent = image.filename;
        imageModalUrl.textContent = image.originalSrc;

        imageModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку страницы

        updateNavigationButtons();
    }

    function closeImageModal() {
        imageModal.style.display = 'none';
        document.body.style.overflow = ''; // Восстанавливаем прокрутку
    }

    function showPrevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            openImageModal(currentImageIndex);
        }
    }

    function showNextImage() {
        if (currentImageIndex < allImages.length - 1) {
            currentImageIndex++;
            openImageModal(currentImageIndex);
        }
    }

    function updateNavigationButtons() {
        if (imageModalPrev) {
            imageModalPrev.style.display = currentImageIndex > 0 ? 'block' : 'none';
        }
        if (imageModalNext) {
            imageModalNext.style.display = currentImageIndex < allImages.length - 1 ? 'block' : 'none';
        }
    }

    function handleKeyboardNavigation(event) {
        if (imageModal.style.display === 'block') {
            switch(event.key) {
                case 'Escape':
                    closeImageModal();
                    break;
                case 'ArrowLeft':
                    showPrevImage();
                    break;
                case 'ArrowRight':
                    showNextImage();
                    break;
            }
        }
    }

    function handleImagePreviewClick(e) {
        if (e.target.classList.contains('image-preview')) {
            // Собираем все изображения на странице
            allImages = Array.from(document.querySelectorAll('.image-preview')).map((img, index) => ({
                originalSrc: img.getAttribute('data-original-src') || img.src,
                filename: img.getAttribute('data-filename') || 'Изображение',
                index: index
            }));

            // Находим индекс текущего изображения
            const clickedIndex = allImages.findIndex(img =>
                img.originalSrc === (e.target.getAttribute('data-original-src') || e.target.src)
            );

            if (clickedIndex !== -1) {
                openImageModal(clickedIndex);
            }
        }
    }

    function handleTemplateChange() {
        const selectedTemplate = this.value;
        currentTemplate = selectedTemplate;
        populateArticleList(selectedTemplate);

        if (selectedTemplate) {
            // При выборе каталога показываем все его артикулы
            displayUrls(selectedTemplate);
        } else {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Выберите каталог';
            bulkActions.style.display = 'none';
            articleSelect.disabled = true;
        }
    }

    function handleArticleChange() {
        const selectedArticle = this.value;
        currentArticle = selectedArticle;

        if (currentTemplate) {
            // При выборе артикула показываем только его, при сбросе - все артикулы каталога
            displayUrls(currentTemplate, selectedArticle);
        } else {
            urlList.innerHTML = '';
            archiveTitle.textContent = 'Выберите каталог';
            bulkActions.style.display = 'none';
        }
    }

    function closeXLSXModal() {
        xlsxModal.style.display = 'none';
        templateSelectForXLSX.value = '';
        separatorSection.style.display = 'none';
        separatorSelect.value = 'comma';
    }

    function handleXLSXGeneration() {
        const selectedTemplate = templateSelectForXLSX.value;
        let separator = 'comma'; // по умолчанию

        if (selectedTemplate === 'В ячейку') {
            separator = separatorSelect.value;
        }

        if (selectedTemplate) {
            // Показываем информативное сообщение о том, что генерируется
            let message = `Генерация документа для шаблона: ${selectedTemplate}`;
            if (currentTemplate) {
                message += `, альбом: ${currentTemplate}`;
            }
            if (currentArticle) {
                message += `, артикул: ${currentArticle}`;
            } else if (currentTemplate) {
                message += `, все артикулы`;
            }

            showNotification(message, 'success');
            closeXLSXModal();
            downloadXLSXDocument(selectedTemplate, separator);
        } else {
            showNotification('Пожалуйста, выберите шаблон.', 'error');
        }
    }

    function handleWindowClick(event) {
        if (event.target === xlsxModal) closeXLSXModal();
        if (event.target === imageModal) closeImageModal();
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

    /**
     * Получает текущие отображаемые данные из DOM
     */
    function getCurrentDisplayData() {
        const currentData = [];
        const urlItems = document.querySelectorAll('#urlList .url-item');

        urlItems.forEach(urlItem => {
            const articleElement = urlItem.querySelector('.article-info');
            const urlElement = urlItem.querySelector('.url-text');
            const filenameElement = urlItem.querySelector('small');

            if (articleElement && urlElement) {
                const article = articleElement.textContent.replace('Артикул: ', '').trim();
                const url = urlElement.getAttribute('data-url');
                const filename = filenameElement ? filenameElement.textContent : url.split('/').pop();

                currentData.push({
                    url: url,
                    article: article,
                    filename: filename
                });
            }
        });

        return currentData;
    }

    function downloadXLSXDocument(selectedTemplateName, separator = 'comma') {
        const currentData = getCurrentDisplayData();

        if (currentData.length === 0) {
            showNotification('Нет данных для генерации документа', 'error');
            return;
        }

        // Применяем сортировку к текущим данным
        const sortedData = [...currentData].sort((a, b) => {
            // Сортировка по артикулу
            if (a.article < b.article) return -1;
            if (a.article > b.article) return 1;

            // Если артикулы равны, сортировка по числовому порядковому номеру из имени файла
            const matchA = a.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);
            const matchB = b.filename.match(/_(\d+)_[a-f0-9]+\.\w+$/);

            const numA = matchA ? parseInt(matchA[1], 10) : 0;
            const numB = matchB ? parseInt(matchB[1], 10) : 0;

            return numA - numB;
        });

        // Формируем imageDataToSend из отсортированной структуры
        const imageDataToSend = sortedData.map(item => ({
            url: item.url,
            article: item.article,
            filename: item.filename
        }));

        if (!selectedTemplateName.trim()) {
            showNotification('Имя шаблона пустое. Невозможно выбрать шаблон.', 'error');
            return;
        }

        showNotification('Генерация XLSX документа...', 'success');

        fetch('/admin/download-xlsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: imageDataToSend, // Отправляем только текущие данные
                template_name: selectedTemplateName,
                separator: separator
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

            // Формируем информативное имя файла
            let filenameParts = [selectedTemplateName];

            if (currentTemplate) {
                filenameParts.push(currentTemplate);
            }
            if (currentArticle) {
                filenameParts.push(currentArticle);
            }

            filenameParts.push(separator === 'newline' ? 'перенос' : 'запятые');

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `${filenameParts.join('_')}_${timestamp}.xlsx`;

            a.download = filename;
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