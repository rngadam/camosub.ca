document.addEventListener('DOMContentLoaded', () => {
    // Initialize AOS
    AOS.init({
        duration: 1000, // Durée de l'animation en millisecondes
        once: true, // Animation uniquement lors du premier défilement
    });

    // Language Switcher Logic
    const langButtons = document.querySelectorAll('.lang-button');
    const langFrSections = document.querySelectorAll('.lang-fr');
    const langEnSections = document.querySelectorAll('.lang-en');
    const blogLinkFr = document.getElementById('blog-link-fr');
    const blogLinkEn = document.getElementById('blog-link-en');

    const setLanguage = (lang) => {
        if (lang === 'fr') {
            langFrSections.forEach(section => section.style.display = 'block');
            langEnSections.forEach(section => section.style.display = 'none');
            if (blogLinkFr) blogLinkFr.href = 'blog.html?lang=fr';
            if (blogLinkEn) blogLinkEn.href = 'blog.html?lang=en'; // Hidden EN link should point to EN blog
        } else { // lang === 'en'
            langFrSections.forEach(section => section.style.display = 'none');
            langEnSections.forEach(section => section.style.display = 'block');
            if (blogLinkEn) blogLinkEn.href = 'blog.html?lang=en';
            if (blogLinkFr) blogLinkFr.href = 'blog.html?lang=fr'; // Hidden FR link should point to FR blog
        }

        langButtons.forEach(button => {
            const isCurrentLang = button.dataset.lang === lang;
            button.classList.toggle('bg-blue-500', isCurrentLang);
            button.classList.toggle('text-white', isCurrentLang);
            button.classList.toggle('bg-gray-400', !isCurrentLang);
            button.classList.toggle('text-gray-800', !isCurrentLang);
        });
        document.documentElement.lang = lang;
        localStorage.setItem('preferredLang', lang); // Save user preference
    };

    // Auto-detect browser language or load saved preference
    const preferredLang = localStorage.getItem('preferredLang');
    const browserLang = (navigator.language || navigator.userLanguage || 'fr').slice(0, 2);

    if (preferredLang) {
        setLanguage(preferredLang);
    } else if (browserLang === 'en') {
        setLanguage('en');
    } else {
        // Default to French for 'fr' or any other detected language not explicitly handled
        setLanguage('fr');
    }

    langButtons.forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.lang));
    });

    // Bubble Animation Logic
    const bubblesContainer = document.querySelector('.bubbles');
    if (bubblesContainer) {
        function createBubble() {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble'); // Ensure this class matches your CSS

            const size = Math.random() * 40 + 10; // 10px to 50px
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${Math.random() * 100}%`;
            const animationDuration = Math.random() * 10 + 5; // 5s to 15s
            bubble.style.animationDuration = `${animationDuration}s`;
            // bubble.style.animationTimingFunction is set in CSS as 'ease-in' via 'rise' animation

            bubblesContainer.appendChild(bubble);

            setTimeout(() => {
                bubble.remove();
            }, animationDuration * 1000); // Remove bubble after animation
        }

        // Only create bubbles if the container exists
        setInterval(createBubble, 500); // Create a new bubble every 500ms
    }

    // Version Info Fetcher (if it's intended to be on all pages)
    // Note: This was previously in index.html only.
    // If it's meant for all pages, keeping it here is fine. Otherwise, it might need conditional loading or page-specific JS.
    function appendVersionInfoToFooters(element) {
      // Adjusted selectors to be more generic if multiple footers exist per language section
      const selectors = ['.lang-fr footer .container:last-of-type', '.lang-en footer .container:last-of-type'];
      selectors.forEach(selector => {
        const footerContainer = document.querySelector(selector);
        if (footerContainer) {
          // Check if version info already exists to prevent duplicates on language switch
          if (!footerContainer.querySelector('.version-info')) {
            const versionElement = element.cloneNode(true);
            versionElement.classList.add('version-info'); // Add class for identification
            footerContainer.appendChild(versionElement);
          }
        }
      });
    }

    function createVersionElement(text, isError) {
      const versionP = document.createElement('p');
      versionP.classList.add('text-xs', 'text-center', 'mt-4', 'pt-2', 'border-t', 'border-gray-600');
      versionP.textContent = text;
      if (isError) {
        versionP.classList.add('text-red-600');
      } else {
        versionP.classList.add('text-gray-500');
      }
      return versionP;
    }

    // Check if version.json exists and fetch it
    // This check is to prevent errors if version.json is not present on some pages or environments
    if (typeof fetch !== 'undefined') { // Ensure fetch is available
        fetch('version.json')
          .then(response => {
            if (!response.ok) {
              throw new Error('version.json not found or invalid');
            }
            return response.json();
          })
          .then(data => {
            const versionText = `Version: Branch: ${data.branch || 'main'} | Commit: ${data.commit ? data.commit.substring(0, 7) : 'N/A'}`;
            const versionElement = createVersionElement(versionText, false);
            appendVersionInfoToFooters(versionElement);
          })
          .catch(error => {
            console.warn('Could not load version information:', error.message);
            // Only display "Version info not available" if the file was expected but failed to load,
            // not if the file doesn't exist and that's acceptable.
            // For now, we assume it's an error if it fails.
            const errorText = 'Version info not available';
            const errorElement = createVersionElement(errorText, true);
            appendVersionInfoToFooters(errorElement);
          });
    }


    // Dynamic Event Loader (if it's intended to be on all pages or specific ones)
    // This was previously in index.html only.
    // If this is only for index.html, it should be in a separate script loaded only on index.html
    // or conditionally run here. For now, assuming it might be needed elsewhere or can be safely included.
    const frenchEventsContainer = document.getElementById('french-events-container');
    const englishEventsContainer = document.getElementById('english-events-container');

    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    if (frenchEventsContainer && englishEventsContainer) { // Only run if containers exist
        const eventBackgroundClasses = {
            "canadians-2025": "bg-green-100",
            "newbie-training": "bg-yellow-500",
            "summer-tournament-2025": "bg-blue-100"
        };

        function parseISODateStringToDate(dateString) {
            if (!dateString) return null;
            const parts = dateString.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                return new Date(Date.UTC(year, month, day));
            }
            return null;
        }

        function renderEvent(event, lang) {
            // ... (Keep the existing renderEvent function from index.html's script)
            // This function is quite long, for brevity I'm not pasting it here again.
            // Ensure it's copied correctly from the original index.html script.
            // Minor adjustment: make sure it correctly uses `event[lang]` for text and `event.commonField` for shared data.

            if (event.archived === true) {
                return ''; // Do not render archived events
            }
            const eventLangData = event[lang];
            if (!eventLangData) return ''; // Skip if no language-specific data

            const section = document.createElement('section');
            section.id = `event-${event.id}-${lang}`;
            const bgClass = eventBackgroundClasses[event.id] || 'bg-gray-100';
            section.className = `${bgClass} text-gray-900 px-4 py-16 text-center shadow-inner`;

            const containerDiv = document.createElement('div');
            containerDiv.className = 'container mx-auto';

            const title = document.createElement('h1');
            title.className = 'text-3xl md:text-4xl font-bold mb-6';
            title.textContent = eventLangData.title;
            containerDiv.appendChild(title);

            if (event.image) {
                const img = document.createElement('img');
                img.src = event.image;
                img.alt = eventLangData.title;
                img.className = 'mx-auto mb-6 rounded-lg shadow-lg max-w-full md:max-w-2xl';
                containerDiv.appendChild(img);
            }

            if (event.id === 'newbie-training' && eventLangData.description) {
                 const introParagraph = document.createElement('p');
                 introParagraph.className = 'text-xl md:text-2xl mb-8';
                 introParagraph.textContent = eventLangData.description;
                 containerDiv.appendChild(introParagraph);
            }

            const contentWrapperDiv = document.createElement('div');
            contentWrapperDiv.className = 'bg-white rounded-lg shadow-lg p-8 inline-block max-w-xl text-left';

            const dateP = document.createElement('p');
            dateP.className = 'text-2xl font-semibold mb-4';
            const dateLabelSpan = document.createElement('span');
            const dateValueSpan = document.createElement('span');
            dateValueSpan.className = 'text-red-600';

            if (event.recurrence && event.recurrence[lang]) {
                dateLabelSpan.textContent = lang === 'fr' ? 'Quand : ' : 'When: ';
                dateValueSpan.textContent = event.recurrence[lang];
            } else if (event.startDate) {
                dateLabelSpan.textContent = lang === 'fr' ? 'Date : ' : 'Date: ';
                const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
                const startDateObj = parseISODateStringToDate(event.startDate);
                let formattedStartDate = startDateObj ? startDateObj.toLocaleDateString(locale, options) : event.startDate;

                if (event.endDate && event.endDate !== event.startDate) {
                    const endDateObj = parseISODateStringToDate(event.endDate);
                    let formattedEndDate = endDateObj ? endDateObj.toLocaleDateString(locale, options) : event.endDate;
                    dateValueSpan.textContent = `${formattedStartDate} - ${formattedEndDate}`;
                } else {
                    dateValueSpan.textContent = formattedStartDate;
                }
            }

            if (dateValueSpan.textContent) {
                dateP.appendChild(dateLabelSpan);
                dateP.appendChild(dateValueSpan);
                contentWrapperDiv.appendChild(dateP);
            }

            if (event.time) {
                const timeP = document.createElement('p');
                timeP.className = 'text-xl mb-4';
                const timeLabel = lang === 'fr' ? 'Heure : ' : 'Time: ';
                const timeValueSpan = document.createElement('span');
                timeValueSpan.className = 'font-semibold';
                timeValueSpan.textContent = event.time;
                timeP.textContent = timeLabel;
                timeP.appendChild(timeValueSpan);
                contentWrapperDiv.appendChild(timeP);
            }

            if (event.location) {
                const locTitleP = document.createElement('p');
                locTitleP.className = 'text-xl mb-4';
                locTitleP.textContent = lang === 'fr' ? 'Lieu :' : 'Location:';
                contentWrapperDiv.appendChild(locTitleP);

                const locationContainer = document.createElement('div');
                locationContainer.style.display = 'flex';
                locationContainer.style.alignItems = 'center';
                locationContainer.className = 'mb-4';

                const mapLink = document.createElement('a');
                mapLink.target = '_blank';
                mapLink.rel = 'noopener noreferrer';
                mapLink.style.textDecoration = 'none';

                let mapsHref;
                if (event.location.mapsLink && event.location.mapsLink.trim() !== "") {
                    mapsHref = event.location.mapsLink;
                } else {
                    const queryParts = [
                        event.location.name, event.location.address, event.location.city,
                        event.location.province, event.location.postalCode, event.location.country
                    ].filter(part => part && String(part).trim() !== "").join(', ');
                    mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts)}`;
                }
                mapLink.href = mapsHref;

                const mapIcon = document.createElement('i');
                mapIcon.className = 'fa fa-map-marker';
                mapIcon.style.color = 'red';
                mapIcon.style.fontSize = '2.5em';
                mapIcon.style.marginRight = '10px';
                mapIcon.setAttribute('aria-hidden', 'true');

                const ariaLabelText = lang === 'fr' ? 'Voir sur Google Maps' : 'View on Google Maps';
                mapLink.setAttribute('aria-label', ariaLabelText);
                mapLink.title = ariaLabelText;

                mapLink.appendChild(mapIcon);
                locationContainer.appendChild(mapLink);

                const locDetailsP = document.createElement('p');
                locDetailsP.className = 'text-lg font-semibold';
                const locationText = `${event.location.name}<br>${event.location.address}<br>${event.location.city}, ${event.location.province}${event.location.postalCode ? ' ' + event.location.postalCode : ''}${event.location.country && event.location.country.toLowerCase() !== 'canada' ? '<br>' + event.location.country : ''}`;
                locDetailsP.innerHTML = locationText; // Using innerHTML because of <br>
                locationContainer.appendChild(locDetailsP);
                contentWrapperDiv.appendChild(locationContainer);
            }

            if (event.id !== 'newbie-training' && eventLangData.description) {
                const descP = document.createElement('p');
                descP.className = 'text-lg mb-6';
                descP.innerHTML = eventLangData.description;
                contentWrapperDiv.appendChild(descP);
            }

            const costLabel = lang === 'fr' ? 'Coût : ' : 'Cost: ';
            if (eventLangData.cost) {
                const costP = document.createElement('p');
                costP.className = 'text-xl font-semibold mb-4';
                costP.textContent = costLabel;
                const costValueSpan = document.createElement('span');
                costValueSpan.className = 'font-normal';
                costValueSpan.textContent = eventLangData.cost;
                costP.appendChild(costValueSpan);
                contentWrapperDiv.appendChild(costP);
            }

            const equipmentLabel = lang === 'fr' ? 'Équipement nécessaire : ' : 'Required equipment: ';
            if (eventLangData.equipmentNeeded) {
                const equipP = document.createElement('p');
                equipP.className = 'text-xl font-semibold mb-6';
                equipP.textContent = equipmentLabel;
                const equipValueSpan = document.createElement('span');
                equipValueSpan.className = 'font-normal';
                equipValueSpan.textContent = eventLangData.equipmentNeeded;
                equipP.appendChild(equipValueSpan);
                contentWrapperDiv.appendChild(equipP);
            }

            if (eventLangData.programTitle && eventLangData.programDetails && eventLangData.programDetails.length > 0) {
                const programTitleEl = document.createElement('h2');
                programTitleEl.className = 'text-2xl font-bold mb-4 text-gray-800';
                programTitleEl.textContent = eventLangData.programTitle;
                contentWrapperDiv.appendChild(programTitleEl);

                const ul = document.createElement('ul');
                ul.className = 'list-disc list-inside text-gray-700 space-y-2 mb-6';
                eventLangData.programDetails.forEach(itemText => {
                    const li = document.createElement('li');
                    li.textContent = itemText;
                    ul.appendChild(li);
                });
                contentWrapperDiv.appendChild(ul);
            }

            if (eventLangData.notes) {
                const notesP = document.createElement('p');
                notesP.className = 'text-lg italic';
                notesP.textContent = eventLangData.notes;
                contentWrapperDiv.appendChild(notesP);
            }

            containerDiv.appendChild(contentWrapperDiv);

            if (eventLangData.url) {
                const linkA = document.createElement('a');
                linkA.href = eventLangData.url;
                linkA.target = '_blank';
                linkA.rel = 'noopener noreferrer';

                let buttonClasses = 'mt-6 inline-block text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-opacity-80 transition duration-300 shadow-md';
                let iconClass = 'fa fa-external-link-alt mr-2';
                let buttonTextContent = lang === 'fr' ? "Voir l'événement" : "View Event";

                if (eventLangData.url.includes('uwhportal')) {
                    buttonClasses += ' bg-green-600 hover:bg-green-700';
                } else if (eventLangData.url.includes('facebook')) {
                    buttonClasses += ' bg-blue-600 hover:bg-blue-700';
                    iconClass = 'fa fa-facebook mr-2';
                    buttonTextContent = lang === 'fr' ? "Voir l'événement Facebook" : "View Facebook Event";
                } else if (eventLangData.url.startsWith('mailto:')) {
                    buttonClasses += ' bg-gray-800 hover:bg-gray-900';
                    iconClass = 'fa fa-envelope mr-2';
                    buttonTextContent = lang === 'fr' ? "Envoyez-nous un courriel" : "Email us";
                    if (event.id === 'newbie-training') {
                         linkA.className = 'mt-4 inline-block bg-gray-800 text-white px-10 py-4 rounded-full font-bold text-xl hover:bg-gray-900 transition duration-300 shadow-lg';
                    } else {
                        linkA.className = buttonClasses;
                    }
                } else {
                    buttonClasses += ' bg-gray-500 hover:bg-gray-600';
                }
                 if (!(event.id === 'newbie-training' && eventLangData.url.startsWith('mailto:'))) {
                    linkA.className = buttonClasses;
                }

                const iconElement = document.createElement('i');
                iconElement.className = iconClass;
                linkA.appendChild(iconElement);
                linkA.appendChild(document.createTextNode(" " + buttonTextContent));

                if (event.id === 'newbie-training' && eventLangData.url.startsWith('mailto:')) {
                    const contactP = document.createElement('p');
                    contactP.className = 'text-xl md:text-2xl mt-8 mb-6 font-semibold';
                    contactP.textContent = lang === 'fr' ? "Pour participer ou pour plus d'informations :" : "To participate or for more information:";
                    containerDiv.appendChild(contactP);
                    containerDiv.appendChild(linkA);
                } else {
                     contentWrapperDiv.appendChild(linkA);
                }
            }
            section.appendChild(containerDiv);
            return section;
        }


        function renderAllEvents(eventsData) {
            frenchEventsContainer.innerHTML = '';
            englishEventsContainer.innerHTML = '';
            eventsData.forEach(event => {
                const frenchEventHtml = renderEvent(event, 'fr');
                if (frenchEventHtml) frenchEventsContainer.appendChild(frenchEventHtml);
                const englishEventHtml = renderEvent(event, 'en');
                if (englishEventHtml) englishEventsContainer.appendChild(englishEventHtml);
            });
        }

        if (typeof fetch !== 'undefined') { // Ensure fetch is available
            fetch('events.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(eventsData => {
                    renderAllEvents(eventsData);
                })
                .catch(error => {
                    console.error("Could not load or render events:", error);
                    if (frenchEventsContainer) frenchEventsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading French events.</p>';
                    if (englishEventsContainer) englishEventsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading English events.</p>';
                });
        }
    }
});
