// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import testCases from '../../../testdata/condition-test-cases.json';

import {Condition, executeCondition} from './conditions';
import {PropertyField, PropertyValue} from './properties';

interface TestCase {
    name: string;
    fields: PropertyField[];
    values: PropertyValue[];
    condition: Condition;
    shouldPass: boolean;
}

describe('conditions JSON test cases', () => {
    describe('executeCondition', () => {
        testCases.forEach((testCase: TestCase) => {
            it(testCase.name, () => {
                const result = executeCondition(
                    testCase.condition,
                    testCase.fields,
                    testCase.values
                );
                expect(result).toBe(testCase.shouldPass);
            });
        });
    });
});