// --- App Logging Configuration (with defaults, will be updated from config.json) ---
let AppLoggerConfig = {
    enabled: false, // Default to false or a less verbose state like 'warn'
    logLevel: 'warn',
};

/**
 * Application logging function.
 * Must be defined after the initial AppLoggerConfig.
 * Logs messages to the console if AppLoggerConfig.enabled is true and the message's
 * level is at or above AppLoggerConfig.logLevel.
 * @param {string} level - The log level (e.g., 'debug', 'info', 'warn', 'error').
 * @param {...any} args - Messages or objects to log.
 */
function appLog(level, ...args) {
    if (!AppLoggerConfig.enabled) {
        return;
    }

    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(AppLoggerConfig.logLevel.toLowerCase());
    const messageLevelIndex = levels.indexOf(level.toLowerCase());

    // If the level is not recognized, or if the message level is below the config level, don't log.
    if (messageLevelIndex === -1 || messageLevelIndex < configLevelIndex) {
        return;
    }

    const timestamp = new Date().toISOString();
    let consoleMethod = console.log; // Default to console.log

    // Use specific console methods if they exist (e.g., console.error, console.warn)
    // This also helps them appear with different styling in some browser consoles.
    if (console[level.toLowerCase()] && typeof console[level.toLowerCase()] === 'function') {
        consoleMethod = console[level.toLowerCase()];
    }

    // Prepend timestamp and level to the log arguments
    consoleMethod(`[${timestamp}] [${level.toUpperCase()}]`, ...args); // Corrected to use backticks
}
// --- End App Logging ---

async function loadAppConfig() {
    try {
        const response = await fetch('config.json'); // Assuming config.json is in the same directory or accessible via this path
        if (!response.ok) {
            console.error('Failed to fetch config.json. Status:', response.status, 'Using default AppLoggerConfig.');
            return;
        }
        const fetchedConfig = await response.json();

        // Update AppLoggerConfig, merging fetched settings with defaults
        if (fetchedConfig.logging) {
            AppLoggerConfig.enabled = typeof fetchedConfig.logging.enabled === 'boolean' ? fetchedConfig.logging.enabled : AppLoggerConfig.enabled;
            AppLoggerConfig.logLevel = fetchedConfig.logging.logLevel || AppLoggerConfig.logLevel;
        }

        // Example for other settings (if any were defined in AppLoggerConfig defaults or elsewhere)
        // if (fetchedConfig.otherSettings) { ... }

        // Use console.log here for reliable feedback on what config was loaded,
        // as appLog's behavior depends on this loaded config.
        console.log("AppLoggerConfig after attempting to load config.json:", JSON.parse(JSON.stringify(AppLoggerConfig)));

    } catch (error) {
        console.error('Error loading or parsing config.json:', error, 'Using default AppLoggerConfig.');
    }
}

let allClubs = [];
let currentLanguage = 'en'; // Default language
let selectedSport = 'All';
let selectedProvince = 'All';

const provinceTimezones = {
    "Alberta": "America/Edmonton",
    "British Columbia": "America/Vancouver",
    "Manitoba": "America/Winnipeg",
    "New Brunswick": "America/Moncton",
    "Newfoundland and Labrador": "America/St_Johns",
    "Nova Scotia": "America/Halifax",
    "Ontario": "America/Toronto",
    "Prince Edward Island": "America/Halifax",
    "Quebec": "America/Montreal",
    "Saskatchewan": "America/Regina",
    "Northwest Territories": "America/Yellowknife",
    "Nunavut": "America/Iqaluit", // Note: Nunavut has multiple timezones
    "Yukon": "America/Whitehorse"
};
const defaultTimezone = "America/Toronto";

const headersMap = {
    'en': {
        sportType: "Sport Type",
        clubName: "Club Name",
        city: "City",
        practiceTimes: "Practice Times",
        practiceLocationColumn: "Practice Location", // Added this
        linksColumn: "Links",
        filterSportTypeLabel: "Filter by Sport Type:",
        filterProvinceLabel: "Filter by Province:",
        allOption: "All",
        AriaDownloadICS: "Download schedule as ICS",
        AriaEmailLink: "Email",
        AriaWebsiteLink: "Visit website",
        AriaFacebookLink: "Visit Facebook page",
        AriaInstagramLink: "Visit Instagram page",
        NotesPrefix: "Notes:"
    },
    'fr': {
        sportType: "Type de sport",
        clubName: "Nom du club",
        city: "Ville",
        practiceTimes: "Heures de pratique",
        linksColumn: "Liens",
        filterSportTypeLabel: "Filtrer par type de sport :",
        filterProvinceLabel: "Filtrer par province :",
        allOption: "Tous",
        AriaDownloadICS: "Télécharger l'horaire en ICS",
        AriaEmailLink: "Courriel",
        AriaWebsiteLink: "Visiter le site web",
        AriaFacebookLink: "Visiter la page Facebook",
        AriaInstagramLink: "Visiter la page Instagram",
        NotesPrefix: "Remarques:"
    }
};

function populateFilterDropdowns(language) {
    const filterControlsContainer = document.getElementById('filter-controls');
    if (!filterControlsContainer) {
        console.error('Filter controls container not found!');
        return;
    }
    filterControlsContainer.innerHTML = ''; // Clear existing filters to prevent duplication

    const langStrings = headersMap[language];

    // Sport Type Filter
    const sportTypeLabel = document.createElement('label');
    sportTypeLabel.setAttribute('for', 'sport-type-filter');
    sportTypeLabel.textContent = langStrings.filterSportTypeLabel + ' ';
    filterControlsContainer.appendChild(sportTypeLabel);

    const sportTypeFilter = document.createElement('select');
    sportTypeFilter.id = 'sport-type-filter';

    const sportTypes = ['All', ...new Set(allClubs.map(club => club.SportType).filter(st => st))].sort();

    sportTypeFilter.innerHTML = '';

    const defaultSportOption = document.createElement('option');
    defaultSportOption.value = 'All';
    defaultSportOption.textContent = langStrings.allOption;
    sportTypeFilter.appendChild(defaultSportOption);

    let uniqueSportTypes = [...new Set(allClubs.map(club => club.SportType).filter(st => st))].sort();

    uniqueSportTypes.forEach(sportType => {
        const option = document.createElement('option');
        option.value = sportType;
        const representativeClub = allClubs.find(club => club.SportType === sportType);
        option.textContent = (language === 'fr' && representativeClub && representativeClub.SportTypeFR) ? representativeClub.SportTypeFR : sportType;
        sportTypeFilter.appendChild(option);
    });
    sportTypeFilter.value = selectedSport;
    sportTypeFilter.addEventListener('change', (e) => {
        selectedSport = e.target.value;
        displayClubs(currentLanguage);
    });
    filterControlsContainer.appendChild(sportTypeFilter);
    filterControlsContainer.appendChild(document.createTextNode(' '));

    // Province Filter
    const provinceLabel = document.createElement('label');
    provinceLabel.setAttribute('for', 'province-filter');
    provinceLabel.textContent = langStrings.filterProvinceLabel + ' ';
    filterControlsContainer.appendChild(provinceLabel);

    const provinceFilter = document.createElement('select');
    provinceFilter.id = 'province-filter';
    provinceFilter.innerHTML = '';

    const defaultProvinceOption = document.createElement('option');
    defaultProvinceOption.value = 'All';
    defaultProvinceOption.textContent = langStrings.allOption;
    provinceFilter.appendChild(defaultProvinceOption);

    let uniqueProvinces = [...new Set(allClubs.map(club => club.Province).filter(p => p))].sort();

    uniqueProvinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province;
        const representativeClub = allClubs.find(club => club.Province === province);
        option.textContent = (language === 'fr' && representativeClub && representativeClub.ProvinceFR) ? representativeClub.ProvinceFR : province;
        provinceFilter.appendChild(option);
    });
    provinceFilter.value = selectedProvince;
    provinceFilter.addEventListener('change', (e) => {
        selectedProvince = e.target.value;
        displayClubs(currentLanguage);
    });
    filterControlsContainer.appendChild(provinceFilter);
}

async function fetchClubData() {
    const url = 'https://docs.google.com/spreadsheets/d/1Lk8Lq5gu-nI1dwZjWZqYM05-x4E-5kD_huPsW-28AMo/gviz/tq';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        let parsedData;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (e) {
            console.error("Error parsing JSON:", e);
            return;
        }

        const actualHeaders = parsedData.table.rows[0].c.map(cell => (cell && cell.v) ? cell.v : '');
        const headerKeyToIndex = {};
        actualHeaders.forEach((header, index) => {
            if (header === 'Sport Type') headerKeyToIndex['SportType'] = index;
            if (header === 'Sport Type FR') headerKeyToIndex['SportTypeFR'] = index;
            if (header === 'Province') headerKeyToIndex['Province'] = index;
            if (header === 'Province FR') headerKeyToIndex['ProvinceFR'] = index;
            if (header === 'Club Name') headerKeyToIndex['ClubName'] = index;
            if (header === 'Club Name FR') headerKeyToIndex['ClubNameFR'] = index;
            if (header === 'City') headerKeyToIndex['City'] = index;
            if (header === 'City FR') headerKeyToIndex['CityFR'] = index;
            // Ensure 'Practice Location' and 'Practice Location FR' are explicitly mapped
            if (header === 'Practice Location') headerKeyToIndex['PracticeLocation'] = index;
            if (header === 'Practice Location FR') headerKeyToIndex['PracticeLocationFR'] = index;
            if (header === 'Practice Times') headerKeyToIndex['PracticeTimes'] = index;
            if (header === 'Contact Email') headerKeyToIndex['ContactEmail'] = index;
            if (header === 'Website URL') headerKeyToIndex['WebsiteURL'] = index;
            if (header === 'Facebook URL') headerKeyToIndex['FacebookURL'] = index;
            if (header === 'Instagram URL') headerKeyToIndex['InstagramURL'] = index;
            if (header === 'Notes') headerKeyToIndex['Notes'] = index;
            if (header === 'Notes FR') headerKeyToIndex['NotesFR'] = index;
            if (header === 'RRULE') headerKeyToIndex['RRULE'] = index;
            if (header === 'Practice Times FR') headerKeyToIndex['PracticeTimesFR'] = index; // Added this line
        });

        allClubs = parsedData.table.rows.slice(1).map(row => {
            const club = {};
            if (!row || !row.c) return null;
            for (const key in headerKeyToIndex) {
                const cell = row.c[headerKeyToIndex[key]];
                club[key] = (cell && cell.v !== null && cell.v !== undefined) ? cell.v : "";
            }
            return club;
        }).filter(club => club !== null);

        console.log("Processed club data:", allClubs);
        displayClubs(currentLanguage);

    } catch (error) {
        console.error("Error fetching club data:", error);
        const clubsContainer = document.getElementById('clubs-container');
        if (clubsContainer) clubsContainer.innerHTML = '<p>Error loading club data. Please try again later.</p>';
        const filterControlsContainer = document.getElementById('filter-controls');
        if (filterControlsContainer) filterControlsContainer.innerHTML = '<p>Could not load filters due to data error.</p>';
    }
}

function displayClubs(language) {
    currentLanguage = language;

    if (allClubs.length > 0) {
        populateFilterDropdowns(language);
    } else if (document.getElementById('filter-controls')) {
         document.getElementById('filter-controls').innerHTML = '';
    }

    const clubsContainer = document.getElementById('clubs-container');
    if (!clubsContainer) {
        console.error('Clubs container not found!');
        return;
    }
    clubsContainer.innerHTML = '';

    const langHeaders = headersMap[language];

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>${langHeaders.clubName}</th>
                <th>${langHeaders.sportType}</th>
                <th>${langHeaders.city}</th>
                <th>${langHeaders.practiceTimes}</th>
                <th>${langHeaders.practiceLocationColumn}</th>
                <th>${langHeaders.linksColumn}</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');

    let filteredClubs = allClubs;
    if (selectedSport !== 'All') {
        filteredClubs = filteredClubs.filter(club => club.SportType === selectedSport);
    }
    if (selectedProvince !== 'All') {
        filteredClubs = filteredClubs.filter(club => club.Province === selectedProvince);
    }

    if (filteredClubs.length === 0) {
        const colspanCount = table.querySelector('thead tr').children.length;
        tbody.innerHTML = `<tr><td colspan="${colspanCount}" class="no-clubs-message">No clubs match the current filters.</td></tr>`;
         if (allClubs.length === 0 && !document.getElementById('filter-controls').innerHTML.includes('Could not load filters')) {
            tbody.innerHTML = `<tr><td colspan="${colspanCount}" class="no-clubs-message">No club data available.</td></tr>`;
        }
    } else {
        filteredClubs.forEach(club => {
            const tr = document.createElement('tr');

            const clubName = language === 'fr' ? (club.ClubNameFR || club.ClubName) : club.ClubName;
            const sportType = language === 'fr' ? (club.SportTypeFR || club.SportType) : club.SportType;
            const city = language === 'fr' ? (club.CityFR || club.City) : club.City;
            const practiceTimes = club.PracticeTimes;

            tr.insertCell().textContent = clubName;
            tr.insertCell().textContent = sportType;
            tr.insertCell().textContent = city;

            // Determine Practice Times content based on language
            const practiceTimesCell = tr.insertCell();
            let practiceTimeText = club.PracticeTimes; // Default to English version
            if (language === 'fr' && club.PracticeTimesFR && club.PracticeTimesFR.trim() !== "" && club.PracticeTimesFR.toLowerCase() !== 'na') {
                practiceTimeText = club.PracticeTimesFR;
            } else if (!practiceTimeText || practiceTimeText.trim() === "" || practiceTimeText.toLowerCase() === 'na') {
                practiceTimeText = "NA";
            }
            practiceTimesCell.textContent = practiceTimeText;

            // Determine Practice Location content based on language
            const practiceLocationCell = tr.insertCell();
            let locationContent = club.PracticeLocation; // Default to English or NA
            if (language === 'fr' && club.PracticeLocationFR && club.PracticeLocationFR.trim() !== "" && club.PracticeLocationFR.toLowerCase() !== 'na') {
                locationContent = club.PracticeLocationFR;
            } else if (!locationContent || locationContent.trim() === "" || locationContent.toLowerCase() === 'na') {
                locationContent = "NA";
            }
            practiceLocationCell.innerHTML = locationContent; // Use innerHTML in case of special chars, though textContent is safer if not needed. Given data, textContent is fine.

            const linksCell = tr.insertCell();
            const langHeaders = headersMap[currentLanguage]; // Ensure langHeaders is accessible

            // Helper function to create icon links
            const createIconLink = (href, ariaLabelKey, iconClass, isMailto = false) => {
                const anchor = document.createElement('a');
                anchor.className = 'link-icon-anchor';
                if (!isMailto) {
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                }
                anchor.href = href;
                const ariaLabelText = langHeaders[ariaLabelKey] || ""; // Get base ARIA label
                // Append actual href for context, ensuring it's not undefined/null
                const fullAriaLabel = href ? `${ariaLabelText} ${href}` : ariaLabelText;
                anchor.setAttribute('aria-label', fullAriaLabel);

                const span = document.createElement('span');
                span.className = 'link-icon';
                const iconTag = document.createElement('i'); // Changed variable name from 'icon' to 'iconTag'
                iconTag.className = `fa ${iconClass}`; // e.g., fa-envelope
                iconTag.setAttribute('aria-hidden', 'true');
                span.appendChild(iconTag);
                anchor.appendChild(span);
                return anchor;
            };

            if (club.ContactEmail && club.ContactEmail !== "NA") {
                linksCell.appendChild(createIconLink(`mailto:${club.ContactEmail}`, 'AriaEmailLink', 'fa-envelope', true));
            }
            if (club.WebsiteURL && club.WebsiteURL !== "NA") {
                linksCell.appendChild(createIconLink(club.WebsiteURL, 'AriaWebsiteLink', 'fa-globe'));
            }
            if (club.FacebookURL && club.FacebookURL !== "NA") {
                linksCell.appendChild(createIconLink(club.FacebookURL, 'AriaFacebookLink', 'fa-facebook-square'));
            }
            if (club.InstagramURL && club.InstagramURL !== "NA") {
                linksCell.appendChild(createIconLink(club.InstagramURL, 'AriaInstagramLink', 'fa-instagram'));
            }

            // Create and append the ICS button
            const scheduleButton = document.createElement('button');
            scheduleButton.className = 'ics-button';
            scheduleButton.innerHTML = '<i class="fa fa-calendar" aria-hidden="true"></i>';
            const ariaLabelICS = langHeaders.AriaDownloadICS || "Download schedule as ICS";
            scheduleButton.setAttribute('aria-label', ariaLabelICS);

            if (!club.RRULE || club.RRULE.trim() === "" || club.RRULE.toLowerCase() === "na (contact for times)") {
                scheduleButton.disabled = true;
                appLog('debug', `ICS button disabled for club: ${club.ClubName || 'Unnamed Club'} due to missing/invalid RRULE.`);
            } else {
                scheduleButton.disabled = false;
                const currentClub = club; // Capture club for the closure

                scheduleButton.addEventListener("click", () => {
                    appLog('debug', 'ICS button clicked for club (via addEventListener):', currentClub.ClubName);
                    generateICS(currentClub);
                });

                appLog('debug', `Attached generateICS listener via addEventListener for club: ${currentClub.ClubName || 'Unnamed Club'}`);
            }
            linksCell.appendChild(scheduleButton);

            // If linksCell is empty (no links, and ICS button also not added if it were conditional), add "NA"
            if (linksCell.children.length === 0) {
                linksCell.textContent = "NA";
            }

            tbody.appendChild(tr);
        });
    }
    clubsContainer.appendChild(table);
}

function formatUTCDate(date) {
    return date.getUTCFullYear() +
        ('0' + (date.getUTCMonth() + 1)).slice(-2) +
        ('0' + date.getUTCDate()).slice(-2) + 'T' +
        ('0' + date.getUTCHours()).slice(-2) +
        ('0' + date.getUTCMinutes()).slice(-2) +
        ('0' + date.getUTCSeconds()).slice(-2) + 'Z';
}

function calculateNextDtFromRrule(rruleString, clubPracticeTimeString) {
    const now = new Date();
    let eventDate = new Date(now);

    const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };

    let targetDay = -1, targetHour = -1, targetMinute = -1;

    const rruleParts = rruleString.split(';');
    rruleParts.forEach(part => {
        const [key, value] = part.split('=');
        if (key === 'BYDAY' && value.length === 2) targetDay = dayMap[value];
        if (key === 'BYHOUR') targetHour = parseInt(value, 10);
        if (key === 'BYMINUTE') targetMinute = parseInt(value, 10);
    });

    if (targetDay === -1 || targetHour === -1 || targetMinute === -1) {
        if (clubPracticeTimeString) {
            const timeMatch = clubPracticeTimeString.match(/(\d{1,2})[:h](\d{2})?/i);
            if (timeMatch) {
                targetHour = parseInt(timeMatch[1], 10);
                targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                for (const dayKey in dayMap) {
                    if (clubPracticeTimeString.toLowerCase().includes(dayKey.toLowerCase())) {
                        targetDay = dayMap[dayKey];
                        break;
                    }
                }
                 if (targetDay === -1) targetDay = now.getDay();
            } else {
                 return null;
            }
        } else {
            return null;
        }
    }

    eventDate.setHours(targetHour, targetMinute, 0, 0);

    let daysToAdd = (targetDay - eventDate.getDay() + 7) % 7;
    if (daysToAdd === 0 && eventDate.getTime() < now.getTime()) {
        daysToAdd = 7;
    }
    eventDate.setDate(eventDate.getDate() + daysToAdd);

    const dtstart = new Date(eventDate);
    const dtend = new Date(eventDate);
    dtend.setHours(dtend.getHours() + 1);

    const formatDateForICS = (d) => {
        return d.getFullYear() +
               ('0' + (d.getMonth() + 1)).slice(-2) +
               ('0' + d.getDate()).slice(-2) + 'T' +
               ('0' + d.getHours()).slice(-2) +
               ('0' + d.getMinutes()).slice(-2) +
               ('0' + d.getSeconds()).slice(-2);
    };

    return {
        dtstart: formatDateForICS(dtstart),
        dtend: formatDateForICS(dtend)
    };
}


function generateICS(club) {
    appLog('debug', 'generateICS called for club:', club);
    const lang = currentLanguage; // Used for summary components
    const clubName = lang === 'fr' ? (club.ClubNameFR || club.ClubName) : club.ClubName;
    const sportType = lang === 'fr' ? (club.SportTypeFR || club.SportType) : club.SportType;

    // Determine localized location for ICS
    let locationForICS = club.PracticeLocation || "";
    if (currentLanguage === 'fr' && club.PracticeLocationFR && club.PracticeLocationFR.trim() !== "" && club.PracticeLocationFR.toLowerCase() !== "na") {
        locationForICS = club.PracticeLocationFR;
    } else if (!locationForICS || locationForICS.trim() === "" || locationForICS.toLowerCase() === "na") {
        locationForICS = ""; // If English/default is also NA or empty, make location empty for ICS
    }

    // Determine localized practice times and notes for description
    let practiceTimesForDesc = club.PracticeTimes || "";
    if (currentLanguage === 'fr' && club.PracticeTimesFR && club.PracticeTimesFR.trim() !== "" && club.PracticeTimesFR.toLowerCase() !== "na") {
        practiceTimesForDesc = club.PracticeTimesFR;
    }

    let notesForDesc = club.Notes || "";
    if (currentLanguage === 'fr' && club.NotesFR && club.NotesFR.trim() !== "" && club.NotesFR.toLowerCase() !== "na") {
        notesForDesc = club.NotesFR;
    }

    const langHeaders = headersMap[currentLanguage];
    let description = practiceTimesForDesc.replace(/\r\n|\r|\n/g, "\\n");
    if (notesForDesc) {
        description += `\\n\\n${langHeaders.NotesPrefix} ${notesForDesc.replace(/\r\n|\r|\n/g, "\\n")}`;
    }

    const summary = `${clubName} - ${sportType}`;

    const rruleString = club.RRULE || "";
    if (!rruleString.trim() || rruleString.toLowerCase() === "na (contact for times)") {
        appLog('debug', 'No RRULE found or RRULE is "NA (contact for times)" for club:', clubName);
        alert("No valid recurrence rule found for this club (RRULE is empty or NA).");
        return;
    }
    const individualRrules = rruleString
        .replace(/<br\s*\/?>|&lt;br\s*\/?>/gi, '|')
        .split('|')                                 // Split by |
        .map(rule => rule.trim())                   // Trim whitespace
        .filter(rule => rule.length > 0);           // Remove empty rules

    if (individualRrules.length === 0) {
        appLog('debug', 'No valid individual RRULEs found after parsing for club:', clubName, 'Original RRULE:', club.RRULE);
        alert("No valid individual recurrence rules could be parsed for this club.");
        return;
    }
    appLog('debug', 'About to process individual RRULEs. Count:', individualRrules.length, 'Rules:', individualRrules);


    let icsEvents = [];
    const dtstamp = formatUTCDate(new Date());

    let resolvedTzid = defaultTimezone;
    if (club.Province && provinceTimezones[club.Province]) {
        resolvedTzid = provinceTimezones[club.Province];
    } else if (club.Province) {
        console.warn(`No specific timezone mapping for province: ${club.Province}. Using default: ${defaultTimezone}`);
    }
    // If club.Province is empty/null, it will just use defaultTimezone without a warning.

    for (const rrule of individualRrules) {
        if (rrule.toLowerCase() === "na (contact for times)") continue;

        const dtTimes = calculateNextDtFromRrule(rrule, club.PracticeTimes);
        if (!dtTimes) {
            console.warn(`Could not calculate DTSTART/DTEND for RRULE: ${rrule}. Skipping this event.`);
            continue;
        }

        const uid = `${club.ClubName.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}${Math.random().toString(36).substring(2,5)}@cuga.ca`;

        let eventStr = [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `SUMMARY:${summary}`,
            `LOCATION:${locationForICS.replace(/([,;\\])/g, '\\$1').replace(/\r\n|\r|\n/g, "\\n")}`, // Added ICS escaping
            `DESCRIPTION:${description}`,
            `RRULE:${rrule}`,
            `DTSTART;TZID=${resolvedTzid}:${dtTimes.dtstart}`,
            `DTEND;TZID=${resolvedTzid}:${dtTimes.dtend}`,
            'END:VEVENT'
        ].join('\r\n');
        icsEvents.push(eventStr);
    }

    if (icsEvents.length === 0) {
        appLog('debug', 'No VEVENTs were created for club:', clubName);
        alert("Could not generate any valid events for this club's schedule (no valid VEVENTs created).");
        return;
    }

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CUGA//ClubSchedule//EN',
        ...icsEvents,
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    appLog('debug', 'Blob created:', blob);
    const objectURL = URL.createObjectURL(blob);
    appLog('debug', 'Object URL created:', objectURL);

    const link = document.createElement("a");
    link.href = objectURL;
    const fileName = `${clubName.replace(/[^a-zA-Z0-9]/g, "_")}_schedule.ics`;
    link.setAttribute("download", fileName);

    document.body.appendChild(link);
    appLog('debug', 'Link appended to body. About to click download link. Href:', link.href, 'Download attr:', link.download);
    link.click();

    setTimeout(() => {
        appLog('debug', 'link.click() executed for file:', fileName);
        document.body.removeChild(link);
        URL.revokeObjectURL(objectURL);
        appLog('debug', 'Cleanup: Removed temporary link and revoked object URL for club:', clubName);
    }, 100);
}

document.addEventListener('DOMContentLoaded', async () => { // Make the callback async
    try {
        await loadAppConfig(); // Wait for config to be loaded
        appLog('info', 'Application configuration loaded successfully.'); // Log using appLog
    } catch (error) {
        // This catch is for unexpected errors if loadAppConfig itself threw an unhandled exception
        console.error("Critical error during app configuration loading sequence:", error);
        // AppLoggerConfig will have defaults, appLog might still work with those defaults.
        appLog('error', 'Critical error during app configuration loading sequence. Proceeding with default logging.', error);
    }

    // Proceed to fetch data regardless of config load outcome (loadAppConfig handles its own errors and defaults)
    fetchClubData();

    const langEnButton = document.getElementById('lang-en');
    const langFrButton = document.getElementById('lang-fr');

    if (langEnButton) {
        langEnButton.addEventListener('click', () => {
            selectedSport = 'All';
            selectedProvince = 'All';
            displayClubs('en');
        });
    }
    if (langFrButton) {
        langFrButton.addEventListener('click', () => {
            selectedSport = 'All';
            selectedProvince = 'All';
            displayClubs('fr');
        });
    }
});
