document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('content-container');
    const tocContainer = document.getElementById('toc');
    const tocTitle = document.getElementById('toc-title');
    let currentLang = 'fr';

    function slugify(text) {
        return text.toString().toLowerCase()
            .normalize('NFKD') // Normalize accented characters
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .trim()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(/[^\w-]+/g, '') // Remove all non-word chars
            .replace(/--+/g, '-'); // Replace multiple - with single -
    }

    async function loadContent(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        const markdownPath = lang === 'fr' ? 'docs/histoire_camo_hockey_subaquatique.fr.md' : 'docs/histoire_camo_hockey_subaquatique.en.md';

        try {
            const response = await fetch(markdownPath);
            if (!response.ok) {
                throw new Error(`Failed to load ${markdownPath}: ${response.statusText}`);
            }
            const markdown = await response.text();

            if (lang === 'fr') {
                tocTitle.textContent = "Table des matières";
                document.title = "Notre histoire - Club CAMO";
            } else { // lang === 'en'
                tocTitle.textContent = "Table of Contents";
                document.title = "Our History - Club CAMO";
            }

            // Render markdown content
            contentContainer.innerHTML = marked.parse(markdown);

            // Generate TOC
            tocContainer.innerHTML = '';
            const headings = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const tocList = document.createElement('ul');
            tocList.className = 'space-y-2';

            headings.forEach(heading => {
                // Don't include the main page title (first H1) in TOC if it's the overall page title
                if (heading.tagName === 'H1' && heading === contentContainer.querySelector('h1')) {
                     // Optional: Update the header h1 with this content if desired, or ensure it's styled distinctly
                    // For now, we assume the main title is in the header or handled by the markdown structure.
                } else {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    const id = slugify(heading.textContent);
                    heading.id = id;
                    link.href = `#${id}`;
                    link.textContent = heading.textContent;
                    link.className = 'hover:text-blue-600 hover:underline';
                    if (heading.tagName === 'H2') {
                        link.classList.add('font-semibold');
                    } else if (heading.tagName === 'H3') {
                        link.classList.add('ml-2');
                    } else if (heading.tagName === 'H4') {
                        link.classList.add('ml-4', 'text-sm');
                    } // Add more for H5, H6 if needed
                    listItem.appendChild(link);
                    tocList.appendChild(listItem);
                }
            });
            tocContainer.appendChild(tocList);

            // Style images
            contentContainer.querySelectorAll('img').forEach(img => {
                img.classList.add('mx-auto', 'my-4', 'rounded-lg', 'shadow-md', 'max-w-full', 'h-auto');
                // Remove fixed height/width if any, ensure responsiveness
                img.style.height = 'auto';
            });

        } catch (error) {
            contentContainer.innerHTML = `<p class="text-red-500">Error loading content: ${error.message}</p>`;
            tocContainer.innerHTML = '';
        }
    }

    // Initial load - Standardized Language Detection
    function getInitialLanguage() {
        const urlParams = new URLSearchParams(window.location.search);
        const langFromUrl = urlParams.get('lang');
        if (langFromUrl === 'fr' || langFromUrl === 'en') {
            return langFromUrl;
        }

        const preferredLangStorage = localStorage.getItem('preferredLang');
        if (preferredLangStorage === 'fr' || preferredLangStorage === 'en') {
            return preferredLangStorage;
        }

        const browserLang = (navigator.language || navigator.userLanguage || 'fr').slice(0, 2);
        return (browserLang === 'en' ? 'en' : 'fr');
    }

    const initialLang = getInitialLanguage();
    loadContent(initialLang);


    // Smooth scroll for TOC links
    document.addEventListener('click', function (event) {
        if (event.target.matches('#toc a[href^="#"]')) {
            event.preventDefault();
            const targetId = event.target.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    document.querySelectorAll('.lang-button').forEach(button => {
        button.addEventListener('click', () => {
            loadContent(button.dataset.lang);
        });
    });
});
