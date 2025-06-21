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
  datePosted: 'Past 24 hours',
  experienceLevels: ['Entry level', 'Associate'],
});
