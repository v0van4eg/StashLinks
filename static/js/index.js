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
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyAllListBtn = document.getElementById('copyAllListBtn');
    const archiveInput = document.getElementById('archive');

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

    // Инициализация темы
    initTheme();

    // Инициализация обработчиков событий
    initEventListeners();

    // Функция инициализации темы
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
        } else {
            themeToggle.textContent = '🌙';
        }
    }

    // Функция инициализации всех обработчиков событий
    function initEventListeners() {
        // Переключение темы
        themeToggle.addEventListener('click', toggleTheme);

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

        // Обработчик изменения выбора шаблона
        if (templateSelectForXLSX) {
            templateSelectForXLSX.addEventListener('change', function() {
                if (this.value === 'В ячейку') {
                    separatorSection.style.display = 'block';
                } else {
                    separatorSection.style.display = 'none';
                }
            });
        }

        // Копирование ссылок
        if (copyAllBtn) copyAllBtn.addEventListener('click', copyAllToClipboard);
        if (copyAllListBtn) copyAllListBtn.addEventListener('click', copyAllListToClipboard);

        // Клик по ссылкам для копирования
        document.addEventListener('click', handleUrlClick);

        // Клик по превью изображений
        document.addEventListener('click', handleImagePreviewClick);

        // Кнопки удаления
        document.addEventListener('click', handleDeleteClick);

        // Предпросмотр файлов архива
        if (archiveInput) {
            archiveInput.addEventListener('change', handleArchivePreview);
        }

        // Закрытие модального окна при клике вне его
        window.addEventListener('click', (event) => {
            if (event.target === xlsxModal) closeXLSXModal();
            if (event.target === imageModal) closeImageModal();
        });

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

    // Переключение темы
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

    // Закрытие модального окна XLSX
    function closeXLSXModal() {
        xlsxModal.style.display = 'none';
        templateSelectForXLSX.value = '';
        separatorSection.style.display = 'none';
        separatorSelect.value = 'comma';
    }

    // Обработка генерации XLSX
    function handleXLSXGeneration() {
        const selectedTemplate = templateSelectForXLSX.value;
        let separator = 'comma'; // по умолчанию

        if (selectedTemplate === 'В ячейку') {
            separator = separatorSelect.value;
        }

        if (selectedTemplate) {
            closeXLSXModal();
            downloadXLSXDocument(selectedTemplate, separator);
        } else {
            showNotification('Пожалуйста, выберите шаблон.', 'error');
        }
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

    // Показать уведомление
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

    // Копирование в буфер обмена
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

    // Копирование всех ссылок через запятую
    function copyAllToClipboard() {
        const urlItems = document.querySelectorAll('.url-text');
        if (!urlItems.length) {
            showNotification('Нет ссылок для копирования', 'error');
            return;
        }

        const allUrls = Array.from(urlItems).map(item => item.getAttribute('data-url')).join(', ');
        copyToClipboard(allUrls);
    }

    // Копирование всех ссылок списком
    function copyAllListToClipboard() {
        const urlItems = document.querySelectorAll('.url-text');
        if (!urlItems.length) {
            showNotification('Нет ссылок для копирования', 'error');
            return;
        }

        const allUrls = Array.from(urlItems)
            .map(item => item.getAttribute('data-url'))
            .join('\n');
        copyToClipboard(allUrls);
    }

    // Обработка клика по ссылке
    function handleUrlClick(e) {
        if (e.target.classList.contains('url-text')) {
            if (e.target.classList.contains('copy-hint')) return;

            const url = e.target.getAttribute('data-url');
            if (url) {
                copyToClipboard(url);
                e.target.classList.add('copied');
                setTimeout(() => e.target.classList.remove('copied'), 2000);
            }
        }
    }

    // Генерация XLSX документа
    function downloadXLSXDocument(selectedTemplateName, separator = 'comma') {
        const urlItems = document.querySelectorAll('.url-item');
        if (!urlItems.length) {
            showNotification('Нет ссылок для генерации документа', 'error');
            return;
        }

        const imageData = [];
        document.querySelectorAll('.url-item').forEach(itemElement => {
            const articleElement = itemElement.querySelector('.article-info');
            const urlElement = itemElement.querySelector('.url-text');
            if (articleElement && urlElement) {
                const article = articleElement.textContent.replace('Артикул: ', '').trim();
                imageData.push({
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
                image_data: imageData,
                template_name: selectedTemplateName,
                separator: separator  // Добавляем разделитель
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
            a.download = `${selectedTemplateName}_${separator === 'newline' ? 'перенос' : 'запятые'}_${timestamp}.xlsx`;
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

    // Предпросмотр архива
    function handleArchivePreview(e) {
        const files = e.target.files;
        let previewContainer = document.querySelector('.upload-preview');

        if (previewContainer) previewContainer.remove();

        if (files.length > 0) {
            previewContainer = document.createElement('div');
            previewContainer.className = 'upload-preview';
            previewContainer.innerHTML = '<h3>Выбранный файл:</h3>';

            Array.from(files).forEach(file => {
                const fileInfo = document.createElement('div');
                fileInfo.textContent = file.name;
                previewContainer.appendChild(fileInfo);
            });

            document.querySelector('.upload-section').appendChild(previewContainer);
        }
    }

    // Удаление изображения
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

    // Обработка клика по кнопке удаления
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
