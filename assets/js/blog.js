document.addEventListener('DOMContentLoaded', () => {
    // --- Language Switching ---
    const langButtons = document.querySelectorAll('.lang-button');
    // Post content specific elements will be handled by renderPosts
    let currentLang = 'fr'; // Default language

    function setLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;

        langButtons.forEach(button => {
            button.classList.toggle('bg-blue-500', button.dataset.lang === lang);
            button.classList.toggle('text-white', button.dataset.lang === lang);
            button.classList.toggle('bg-gray-400', button.dataset.lang !== lang);
            button.classList.toggle('text-gray-800', button.dataset.lang !== lang);
        });

        // Toggle visibility of language-specific content within posts
        document.querySelectorAll('.lang-fr-content, .lang-fr-tag').forEach(el => el.style.display = (lang === 'fr' ? (el.tagName === 'SPAN' ? 'inline-block' : 'block') : 'none'));
        document.querySelectorAll('.lang-en-content, .lang-en-tag').forEach(el => el.style.display = (lang === 'en' ? (el.tagName === 'SPAN' ? 'inline-block' : 'block') : 'none'));
    }

    langButtons.forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.lang));
    });

    // --- Fetch and Render Blog Posts ---
    const postsContainer = document.getElementById('blog-posts-container');
    let blogData = null; // Will store the full {config, posts} object

    function renderPosts(data) {
        postsContainer.innerHTML = ''; // Clear existing posts

        const postsToRender = data.posts;
        const tagLabels = data.config && data.config.tag_labels ? data.config.tag_labels : {};

        if (!postsToRender || postsToRender.length === 0) {
            const noPostsMessage = document.createElement('p');
            noPostsMessage.className = 'text-center text-gray-300';
            // Use currentLang for this message as it's outside the post-specific content.
            noPostsMessage.textContent = currentLang === 'fr' ? 'Aucun article de blog pour le moment.' : 'No blog posts yet.';
            postsContainer.appendChild(noPostsMessage);
            return;
        }

        postsToRender.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        postsToRender.forEach(post => {
            const article = document.createElement('article');
            article.className = 'blog-post bg-white text-gray-800 p-6 rounded-lg shadow-xl mb-8';
            article.id = post.id;

            if (post.sport_logo) {
                const logoImg = document.createElement('img');
                logoImg.src = post.sport_logo;
                let logoAltText = "Sport Logo";
                if (post.fr && post.fr.title) logoAltText = post.fr.title + " Logo";
                else if (post.en && post.en.title) logoAltText = post.en.title + " Logo";
                logoImg.alt = logoAltText;
                logoImg.className = 'w-80 mb-3 mx-auto rounded-md shadow-sm';
                article.appendChild(logoImg);
            }

            // French Content Div
            const frDiv = document.createElement('div');
            frDiv.className = 'lang-fr-content';
            const frPostData = post.fr || {};
            const frTitleText = frPostData.title || 'Titre non disponible';
            const frContentText = frPostData.content || 'Contenu non disponible';

            const frTitleEl = document.createElement('h2');
            frTitleEl.className = 'text-3xl font-bold mb-3 text-gray-900 text-center';
            frTitleEl.textContent = frTitleText;
            frDiv.appendChild(frTitleEl);

            const timestampElFr = document.createElement('p');
            timestampElFr.className = 'text-sm text-gray-500 mb-4 text-center';
            try {
                timestampElFr.textContent = new Date(post.timestamp).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
            } catch (e) { timestampElFr.textContent = post.timestamp; }
            frDiv.appendChild(timestampElFr);

            if (post.images && Array.isArray(post.images) && post.images.length > 0) {
                const slideshowContainerFr = document.createElement('div');
                slideshowContainerFr.className = 'slideshow-container';
                post.images.forEach(imgPath => {
                    const img = document.createElement('img');
                    img.src = imgPath;
                    img.alt = frPostData.title ? `Slideshow image for ${frPostData.title}` : 'Slideshow image';
                    slideshowContainerFr.appendChild(img);
                });
                frDiv.appendChild(slideshowContainerFr);
            } else if (post.image) {
                const imgElFr = document.createElement('img');
                imgElFr.src = post.image;
                imgElFr.alt = frPostData.title || 'Post image';
                imgElFr.className = 'mb-4 max-w-full h-auto rounded-md shadow'; // Existing classes for single image
                frDiv.appendChild(imgElFr);
            }
            const frContentEl = document.createElement('div');
            frContentEl.className = 'prose max-w-none text-gray-700 leading-relaxed';
            frDiv.appendChild(frContentEl);

            if (frPostData.content_md && typeof frPostData.content_md === 'string' && frPostData.content_md.trim() !== '') {
                frContentEl.innerHTML = 'Chargement du contenu...';
                fetch(frPostData.content_md)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status} for ${frPostData.content_md}`);
                        }
                        return response.text();
                    })
                    .then(markdownText => {
                        const normalizedText = markdownText.replace(/\\n/g, '\n'); // Normalize \\n to \n
                        frContentEl.innerHTML = marked.parse(normalizedText); // Use marked.parse
                    })
                    .catch(error => {
                        console.error("Error fetching French Markdown:", error);
                        const fallbackContent = frPostData.content || 'Contenu non disponible (erreur de chargement).';
                        const normalizedFallback = fallbackContent.replace(/\\n/g, '\n');
                        frContentEl.innerHTML = marked.parse(normalizedFallback); // Use marked.parse
                    });
            } else {
                const directContent = frPostData.content || 'Contenu non disponible';
                const normalizedDirectContent = directContent.replace(/\\n/g, '\n');
                frContentEl.innerHTML = marked.parse(normalizedDirectContent); // Use marked.parse
            }
            article.appendChild(frDiv);

            // English Content Div
            const enDiv = document.createElement('div');
            enDiv.className = 'lang-en-content';
            const enPostData = post.en || {};
            const enTitleText = enPostData.title || 'Title not available';
            // const enContentText = enPostData.content || 'Content not available'; // Replaced by logic below

            const enTitleEl = document.createElement('h2');
            enTitleEl.className = 'text-3xl font-bold mb-3 text-gray-900 text-center';
            enTitleEl.textContent = enTitleText;
            enDiv.appendChild(enTitleEl);

            const timestampElEn = document.createElement('p');
            timestampElEn.className = 'text-sm text-gray-500 mb-4 text-center';
            try {
                timestampElEn.textContent = new Date(post.timestamp).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
            } catch (e) { timestampElEn.textContent = post.timestamp; }
            enDiv.appendChild(timestampElEn);

            if (post.images && Array.isArray(post.images) && post.images.length > 0) {
                const slideshowContainerEn = document.createElement('div');
                slideshowContainerEn.className = 'slideshow-container';
                post.images.forEach(imgPath => {
                    const img = document.createElement('img');
                    img.src = imgPath;
                    img.alt = enPostData.title ? `Slideshow image for ${enPostData.title}` : 'Slideshow image';
                    slideshowContainerEn.appendChild(img);
                });
                enDiv.appendChild(slideshowContainerEn);
            } else if (post.image) {
                const imgElEn = document.createElement('img');
                imgElEn.src = post.image;
                imgElEn.alt = enPostData.title || 'Post image';
                imgElEn.className = 'mb-4 max-w-full h-auto rounded-md shadow'; // Existing classes for single image
                enDiv.appendChild(imgElEn);
            }
            const enContentEl = document.createElement('div');
            enContentEl.className = 'prose max-w-none text-gray-700 leading-relaxed';
            enDiv.appendChild(enContentEl);

            if (enPostData.content_md && typeof enPostData.content_md === 'string' && enPostData.content_md.trim() !== '') {
                enContentEl.innerHTML = 'Loading content...';
                fetch(enPostData.content_md)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status} for ${enPostData.content_md}`);
                        }
                        return response.text();
                    })
                    .then(markdownText => {
                        const normalizedText = markdownText.replace(/\\n/g, '\n'); // Normalize \\n to \n
                        enContentEl.innerHTML = marked.parse(normalizedText); // Use marked.parse
                    })
                    .catch(error => {
                        console.error("Error fetching English Markdown:", error);
                        const fallbackContent = enPostData.content || 'Content not available (loading error).';
                        const normalizedFallback = fallbackContent.replace(/\\n/g, '\n');
                        enContentEl.innerHTML = marked.parse(normalizedFallback); // Use marked.parse
                    });
            } else {
                const directContent = enPostData.content || 'Content not available';
                const normalizedDirectContent = directContent.replace(/\\n/g, '\n');
                enContentEl.innerHTML = marked.parse(normalizedDirectContent); // Use marked.parse
            }
            article.appendChild(enDiv);

            // Tags (translatable and visibility toggled by setLanguage)
            if (post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'mt-4 pt-3 border-t border-gray-300 text-center';
                post.tags.forEach(tagId => {
                    if (tagLabels[tagId]) {
                        const tagSpanFr = document.createElement('span');
                        tagSpanFr.textContent = tagLabels[tagId]['fr'] || tagLabels[tagId]['en'] || tagId;
                        tagSpanFr.className = 'lang-fr-tag inline-block bg-blue-100 text-blue-800 text-sm font-medium mr-2 my-1 px-3 py-1 rounded-full shadow-xs';
                        tagsContainer.appendChild(tagSpanFr);

                        const tagSpanEn = document.createElement('span');
                        tagSpanEn.textContent = tagLabels[tagId]['en'] || tagLabels[tagId]['fr'] || tagId;
                        tagSpanEn.className = 'lang-en-tag inline-block bg-blue-100 text-blue-800 text-sm font-medium mr-2 my-1 px-3 py-1 rounded-full shadow-xs';
                        tagsContainer.appendChild(tagSpanEn);
                    } else {
                        const fallbackTagSpan = document.createElement('span');
                        fallbackTagSpan.textContent = tagId;
                        fallbackTagSpan.className = 'inline-block bg-gray-200 text-gray-800 text-sm font-medium mr-2 my-1 px-3 py-1 rounded-full shadow-xs';
                        tagsContainer.appendChild(fallbackTagSpan);
                    }
                });
                article.appendChild(tagsContainer);
            }
            postsContainer.appendChild(article);
        });
        // Ensure correct language content is shown after rendering all posts
        setLanguage(currentLang);
    }

    function initializeSlideshows() {
        const slideshowContainers = document.querySelectorAll('.slideshow-container');
        slideshowContainers.forEach(container => {
            const images = container.querySelectorAll('img');
            if (images.length === 0) return;
            let currentIndex = 0;
            images[currentIndex].style.opacity = '1'; // Show first image

            setInterval(() => {
                if (document.hidden) return; // Don't cycle if tab is not visible
                images[currentIndex].style.opacity = '0'; // Hide current
                currentIndex = (currentIndex + 1) % images.length; // Move to next
                images[currentIndex].style.opacity = '1'; // Show next
            }, 3500); // Change image every 3.5 seconds
        });
    }

    function fetchAndRenderPosts() {
        if (blogData) { // Use cached data if available
            renderPosts(blogData);
            // setLanguage(currentLang); // This is called by renderPosts at its end
            initializeSlideshows(); // Call here for cached data
        } else {
            fetch('blog.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    blogData = data; // Cache the entire object {config, posts}
                    renderPosts(data);
                    // setLanguage(currentLang) is called at the end of renderPosts
                    initializeSlideshows(); // Call here after new data is rendered
                })
                .catch(error => {
                    console.error("Could not load or render blog posts:", error);
                    postsContainer.innerHTML = `<p class="text-red-400 text-center py-8">Error loading blog posts: ${error.message}</p>`;
                });
        }
    }

    // --- Initial Setup ---
    const urlParams = new URLSearchParams(window.location.search);
    const langFromUrl = urlParams.get('lang');
    const preferredLangStorage = localStorage.getItem('preferredBlogLang'); // Use a different storage key if needed
    const browserLang = (navigator.language || navigator.userLanguage || 'fr').slice(0, 2);

    if (langFromUrl === 'en' || langFromUrl === 'fr') {
        currentLang = langFromUrl;
    } else if (preferredLangStorage === 'en' || preferredLangStorage === 'fr') {
        currentLang = preferredLangStorage;
    } else {
        currentLang = (browserLang === 'en' ? 'en' : 'fr');
    }

    localStorage.setItem('preferredBlogLang', currentLang); // Save the determined language
    setLanguage(currentLang); // Set language for static parts and prepare currentLang
    fetchAndRenderPosts(); // Fetch data and render posts

    // Bubble script from index.html
    const bubblesContainer = document.querySelector('.bubbles');
    if (!bubblesContainer) return;

    function createBubble() {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        const size = Math.random() * 40 + 10; // 10px to 50px
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 100}%`;
        const animationDuration = Math.random() * 10 + 5; // 5s to 15s
        bubble.style.animationDuration = `${animationDuration}s`;
        bubblesContainer.appendChild(bubble);
        setTimeout(() => {
            bubble.remove();
        }, animationDuration * 1000);
    }
    setInterval(createBubble, 500);
});
