// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Local ESLint plugin enforcing e2e-tests/playwright/AGENTS.md conventions in spec files.
// Tests: eslint-rules/tests/*.test.mjs (npm run test:eslint-rules).

import noFixedWaits from './no-fixed-waits.mjs';
import noLocatorsInSpecs from './no-locators-in-specs.mjs';
import noUnconditionalSkip from './no-unconditional-skip.mjs';

export default {
    meta: {name: 'playbooks-e2e'},
    rules: {
        'no-locators-in-specs': noLocatorsInSpecs,
        'no-fixed-waits': noFixedWaits,
        'no-unconditional-skip': noUnconditionalSkip,
    },
};
