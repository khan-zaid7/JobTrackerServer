// apply job filters service:

export let FILTER_BUTTON = (filterLabel = null) => {
    return `button.search-reusables__filter-pill-button:has-text("${filterLabel}")`;
} 

export let ACTIVE_FILTER_MENU = () => {
    return `.artdeco-hoverable-content__content:visible`;
}

export let FILTER_OPTION_LOCATOR = (name = null) => {
    return `.search-reusables__value-label:has-text("${name}")`
}

export let SHOW_RESULTS_BUTTON = () => {
    return `button.artdeco-button--primary`;
}

export let JOB_CARD_CONTAINER_LINK = () => {
    return `.job-card-container__link`;
}

//   Login To Linkedin service:

export let LINKEDIN_LOGIN_URL = () => {
    return `https://www.linkedin.com/login`;
}

export let LOGIN_EMAIL_INPUT = () => {
    return `#username`;
}

export let LOGIN_PASSWORD_INPUT = () => {
    return `#password`;
}

export let LOGIN_BUTTON_LOCATOR = () => {
    return `button[type="submit"]`;
}

export let GLOBAL_NAV = () => {
    return `#global-nav`;
}

// NAVIGATE TO JOBS Service:
export let JOBS_NAV = () => {
    return `nav.global-nav__nav a`;
}

export let JOBS_PAGE_LOCATOR = () => {
    return `**/jobs/**`;
}

// Perform Job Search Service

export let LOCATION_INPUT = () => {
    return `input[id^="jobs-search-box-location-id"]`;
}

export let TITLE_INPUT = () => {
    return `input[id^="jobs-search-box-keyword-id"]`;
}

export let SUGGESTION_LOCATOR = () => {
    return `.jobs-search-box__typeahead-results li`;
}
// selectors.js

/**
 * Centralized collection of CSS selectors for new functionality
 * being built from scratch (e.g., list scrolling, pagination, detail card interaction).
 * Existing selectors used by other services (like login, navigation, search, filters)
 * are NOT included here to avoid conflicts with existing codebases.
 */
export const selectors = {
     // Selector for the main scrollable DIV element containing job cards.
    // Corrected based on the latest screenshot. This targets the div with class 'scaffold-layout__list'.
    scrollableJobsContainer: 'div.scaffold-layout__list > div',

    // Selector for the element displaying the total number of job results.
    // Corrected based on the provided screenshot to target the specific span containing the count.
    // Example: "243,990 results"
    totalResultsCount: '.jobs-search-results-list__text small span[dir="ltr"]',

    // Selector for individual job card LI elements within the UL.
    // Revised to use the highly robust 'data-occludable-job-id' attribute.
    jobCardLi: 'li[data-occludable-job-id]',

    // Selector for the "Next" pagination button.
    paginationNextButton: 'button[aria-label="Next"]',

    // Selector for the job details card that appears on the right when an LI is clicked.
    jobDetailCard: '.jobs-search__job-details--wrapper',
};

