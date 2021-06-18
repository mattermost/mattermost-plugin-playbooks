import {useState} from 'react';

import {Incident} from 'src/types/incident';

let idCounter = 0;

// uniqueId generates a unique id with an optional prefix.
export const uniqueId = (prefix ?: string) => prefix + String(++idCounter);

// useUniqueId exports a React hook simplifying the use of uniqueId.
//
// Note that changes to the prefix will not effect a change to the unique identifier.
export const useUniqueId = (prefix ?: string) => {
    const [id] = useState(() => uniqueId(prefix));

    return id;
};

// findLastUpdated returns the date (in millis) that the incident was last updated, or 0 if it
// hasn't been updated yet.
export const findLastUpdated = (incident: Incident) => {
    const posts = [...incident.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);
    return posts.length === 0 ? 0 : posts[0].create_at;
};

// findLastUpdatedWithDefault returns the date (in millis) that the incident was last updated,
// or the incident's create_at if it hasn't been updated yet.
export const findLastUpdatedWithDefault = (incident: Incident) => {
    const lastUpdated = findLastUpdated(incident);
    return lastUpdated > 0 ? lastUpdated : incident.create_at;
};
