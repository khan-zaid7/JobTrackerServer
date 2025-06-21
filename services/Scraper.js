import { createOrLoadSessionContext } from '../helpers/createOrLoadSessionContext.js';
import { clickJobsNav } from '../services/navigateToJobs.js';
import { performJobSearch } from '../services/performJobSearch.js';
import { applyFilter } from './applyJobFilters.js';
const { browser, context, page } = await createOrLoadSessionContext();

await clickJobsNav(page);

await performJobSearch(page, {
  title: 'Software Developer',
  location: 'Canada'
});

// Now that filters are present, apply them
await applyFilter(page, {
    "Date posted": 'Past 24 hours',
    "Experience level": ['Entry level', 'Associate']
  });
