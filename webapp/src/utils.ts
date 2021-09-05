import {useState} from 'react';

import {PlaybookRun} from 'src/types/playbook_run';

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

// findLastUpdated returns the date (in millis) that the playbook run was last updated, or 0 if it
// hasn't been updated yet.
export const findLastUpdated = (playbookRun: PlaybookRun) => {
    const posts = [...playbookRun.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);
    return posts.length === 0 ? 0 : posts[0].create_at;
};

// findLastUpdatedWithDefault returns the date (in millis) that the playbook run was last updated,
// or the playbook run's create_at if it hasn't been updated yet.
export const findLastUpdatedWithDefault = (playbookRun: PlaybookRun) => {
    const lastUpdated = findLastUpdated(playbookRun);
    return lastUpdated > 0 ? lastUpdated : playbookRun.create_at;
};

export const roundToNearest = (n: number, multiple: number) => {
    if (n > 0) {
        return Math.ceil(n / multiple) * multiple;
    } else if (n < 0) {
        return Math.floor(n / multiple) * multiple;
    }
    return n;
};
