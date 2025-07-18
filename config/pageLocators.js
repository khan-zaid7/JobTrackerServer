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