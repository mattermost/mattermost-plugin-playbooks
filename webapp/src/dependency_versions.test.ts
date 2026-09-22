// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import path from 'path';

import {debounce, isEqual, throttle} from 'lodash';
import range from 'lodash/range';
import lodashThrottle from 'lodash/throttle';

type DeclarationMap = Record<string, string>;

type PackageManifest = {
    dependencies?: DeclarationMap;
    optionalDependencies?: DeclarationMap;
    peerDependencies?: DeclarationMap;
    overrides?: Record<string, string | DeclarationMap>;
};

// `dev` is the only marker that takes an entry out of the runtime tree; the rest stay in it.
type LockfileEntry = {
    version?: string;
    resolved?: string;
    dev?: boolean;
    optional?: boolean;
    devOptional?: boolean;
    peer?: boolean;
    inBundle?: boolean;
    link?: boolean;
    dependencies?: Record<string, LockfileEntry>;
};

type Lockfile = {
    packages?: Record<string, LockfileEntry>;
    dependencies?: Record<string, LockfileEntry>;
};

type VersionTriple = [number, number, number];

type Declaration = {subject: string; name: string; declaredRange: string};

type ResolvedCopy = {subject: string; version: string};

type Finding = {subject: string; reason: string};

type GuardCase = {manifest?: PackageManifest; lockfile?: Lockfile};

const LODASH_PACKAGES = ['lodash', 'lodash-es'];

const SUPPORTED_FLOOR: VersionTriple = [4, 18, 1];

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

const LOWER_BOUND_PATTERN = /^(?:\^|~|>=)?v?(\d+)\.(\d+)\.(\d+)$/;

// The manifest sections npm takes a version from when it resolves the tree.
const DECLARATION_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const;

function readManifest<T>(fileName: string): T {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8')) as T;
}

function packageNameOf(location: string): string {
    return location.split('node_modules/').pop() || '';
}

function toTriple(match: RegExpExecArray): VersionTriple {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Reads a concrete version, and nothing else.
function parseVersion(version: string): VersionTriple | null {
    const match = VERSION_PATTERN.exec(version.trim());
    return match ? toTriple(match) : null;
}

// Reads the lowest version a range admits, for the range forms whose lower bound is stated directly.
function parseLowerBound(declaredRange: string): VersionTriple | null {
    const match = LOWER_BOUND_PATTERN.exec(declaredRange.trim());
    return match ? toTriple(match) : null;
}

function compareVersions(left: VersionTriple, right: VersionTriple): number {
    for (let part = 0; part < left.length; part++) {
        if (left[part] !== right[part]) {
            return left[part] - right[part];
        }
    }

    return 0;
}

function format(version: VersionTriple): string {
    return version.join('.');
}

// Collects every declaration npm honours, in each of the sections and in both forms `overrides` accepts.
function declaredRanges(manifest: PackageManifest): Declaration[] {
    const declarations: Declaration[] = [];

    const add = (subject: string, name: string, declaredRange: string) => {
        if (LODASH_PACKAGES.includes(name)) {
            declarations.push({subject, name, declaredRange});
        }
    };

    for (const section of DECLARATION_SECTIONS) {
        for (const [name, declaredRange] of Object.entries(manifest[section] || {})) {
            add(`${section}.${name}`, name, declaredRange);
        }
    }

    for (const [name, override] of Object.entries(manifest.overrides || {})) {
        if (typeof override === 'string') {
            add(`overrides.${name}`, name, override);
            continue;
        }

        for (const [nestedName, nestedRange] of Object.entries(override)) {
            add(`overrides.${name}.${nestedName}`, nestedName, nestedRange);
        }
    }

    return declarations;
}

// Collects every copy that is part of the installed runtime tree, at any nesting depth.
function resolvedCopies(lockfile: Lockfile): ResolvedCopy[] {
    const copies: ResolvedCopy[] = [];

    for (const [location, entry] of Object.entries(lockfile.packages || {})) {
        if (entry.dev || !LODASH_PACKAGES.includes(packageNameOf(location))) {
            continue;
        }

        copies.push({subject: location, version: entry.version || ''});
    }

    // lockfileVersion 2 carries a second copy of the tree that older npm clients read instead.
    const walkMirror = (tree: Record<string, LockfileEntry> | undefined, prefix: string) => {
        for (const [name, entry] of Object.entries(tree || {})) {
            if (!entry.dev && LODASH_PACKAGES.includes(name)) {
                copies.push({subject: `${prefix}${name}`, version: entry.version || ''});
            }

            walkMirror(entry.dependencies, `${prefix}${name}/`);
        }
    };

    walkMirror(lockfile.dependencies, 'dependencies/');

    return copies;
}

function rangeFindings(declarations: Declaration[]): Finding[] {
    const findings: Finding[] = [];

    for (const {subject, declaredRange} of declarations) {
        const lowerBound = parseLowerBound(declaredRange);
        if (!lowerBound) {
            findings.push({subject, reason: `"${declaredRange}" has no directly readable lower bound`});
            continue;
        }

        if (compareVersions(lowerBound, SUPPORTED_FLOOR) < 0) {
            findings.push({subject, reason: `lower bound ${format(lowerBound)} is below ${format(SUPPORTED_FLOOR)}`});
        }
    }

    return findings;
}

function versionFindings(copies: ResolvedCopy[]): Finding[] {
    const findings: Finding[] = [];

    for (const {subject, version} of copies) {
        const resolved = parseVersion(version);
        if (!resolved) {
            findings.push({subject, reason: `"${version}" is not a concrete version`});
            continue;
        }

        if (compareVersions(resolved, SUPPORTED_FLOOR) < 0) {
            findings.push({subject, reason: `${version} is below ${format(SUPPORTED_FLOOR)}`});
        }
    }

    return findings;
}

function report(findings: Finding[]): string[] {
    return findings.map(({subject, reason}) => `${subject}: ${reason}`);
}

describe('lodash dependencies', () => {
    it('declared ranges exclude versions below the supported floor', () => {
        const declarations = declaredRanges(readManifest<PackageManifest>('package.json'));

        expect(declarations.length).toBeGreaterThan(0);
        expect(report(rangeFindings(declarations))).toEqual([]);
    });

    it('resolved runtime copies are at or above the supported floor', () => {
        const copies = resolvedCopies(readManifest<Lockfile>('package-lock.json'));

        expect(copies.length).toBeGreaterThan(0);
        expect(report(versionFindings(copies))).toEqual([]);
    });

    it.each<[string, GuardCase, string[]]>([
        [
            'a runtime copy nested at any depth',
            {
                lockfile: {
                    packages: {
                        'node_modules/mattermost-redux/node_modules/lodash': {version: '4.17.21'},
                        'node_modules/a/node_modules/b/node_modules/lodash-es': {version: '4.17.21'},
                    },
                },
            },
            [
                'node_modules/mattermost-redux/node_modules/lodash',
                'node_modules/a/node_modules/b/node_modules/lodash-es',
            ],
        ],
        [
            'nothing for a copy reachable only through the dev graph',
            {lockfile: {packages: {'node_modules/a/node_modules/lodash': {version: '4.17.21', dev: true}}}},
            [],
        ],
        [
            'a copy carrying an npm marker other than dev',
            {
                lockfile: {
                    packages: {
                        'node_modules/optional/node_modules/lodash': {version: '4.17.21', optional: true},
                        'node_modules/peer/node_modules/lodash': {version: '4.17.21', peer: true},
                        'node_modules/devoptional/node_modules/lodash': {version: '4.17.21', devOptional: true},
                        'node_modules/bundled/node_modules/lodash': {version: '4.17.21', inBundle: true},
                    },
                },
            },
            [
                'node_modules/optional/node_modules/lodash',
                'node_modules/peer/node_modules/lodash',
                'node_modules/devoptional/node_modules/lodash',
                'node_modules/bundled/node_modules/lodash',
            ],
        ],
        [
            'a linked entry that states no version at all',
            {lockfile: {packages: {'node_modules/lodash': {resolved: '../lodash', link: true}}}},
            ['node_modules/lodash'],
        ],
        [
            'a prerelease of the supported floor',
            {lockfile: {packages: {'node_modules/lodash': {version: '4.18.1-beta.1'}}}},
            ['node_modules/lodash'],
        ],
        [
            'a copy in the tree that lockfileVersion 2 keeps for older npm clients',
            {
                lockfile: {
                    packages: {},
                    dependencies: {
                        '@graphql-codegen/cli': {version: '2.0.0', dev: true, dependencies: {lodash: {version: '4.17.21', dev: true}}},
                        'mattermost-redux': {version: '11.8.0', dependencies: {lodash: {version: '4.17.21'}}},
                    },
                },
            },
            ['dependencies/mattermost-redux/lodash'],
        ],
        [
            'nothing for lockfile keys that name no installed package',
            {lockfile: {packages: {'': {version: '1.0.0'}, 'packages/app': {version: '1.0.0'}}}},
            [],
        ],
        [
            'nothing for package names that only resemble the ones being tracked',
            {
                manifest: {
                    dependencies: {
                        'lodash.merge': '4.6.2',
                        'lodash.throttle': '4.1.1',
                        '@types/lodash': '4.14.178',
                        'lodash-es-something': '1.0.0',
                    },
                },
                lockfile: {
                    packages: {
                        'node_modules/lodash.merge': {version: '4.6.2'},
                        'node_modules/@types/lodash': {version: '4.14.178'},
                        'node_modules/lodash-es-something': {version: '1.0.0'},
                        'node_modules/lodash/node_modules/reusify': {version: '1.0.0'},
                    },
                },
            },
            [],
        ],
        [
            'a declaration made outside the dependencies section',
            {
                manifest: {
                    optionalDependencies: {lodash: '4.17.21'},
                    peerDependencies: {'lodash-es': '^4.17.21'},
                    overrides: {
                        lodash: '4.17.21',
                        'mattermost-redux': {lodash: '4.17.21'},
                    },
                },
            },
            [
                'optionalDependencies.lodash',
                'peerDependencies.lodash-es',
                'overrides.lodash',
                'overrides.mattermost-redux.lodash',
            ],
        ],
        [
            'a range whose lowest admitted version is not stated directly',
            {manifest: {dependencies: {lodash: '4.x'}, peerDependencies: {'lodash-es': '*'}, overrides: {lodash: '<=4.18.1'}}},
            ['dependencies.lodash', 'peerDependencies.lodash-es', 'overrides.lodash'],
        ],
        [
            'a lower bound that only looks high when read as text',
            {manifest: {dependencies: {lodash: '^4.9.0'}}},
            ['dependencies.lodash'],
        ],
        [
            'a manifest and lockfile that state different versions',
            {
                manifest: {dependencies: {lodash: '^4.18.1'}},
                lockfile: {packages: {'node_modules/lodash': {version: '4.17.21'}}},
            },
            ['node_modules/lodash'],
        ],
    ])('reports %s', (_label, {manifest = {}, lockfile = {}}, expected) => {
        const findings = [
            ...rangeFindings(declaredRanges(manifest)),
            ...versionFindings(resolvedCopies(lockfile)),
        ];

        expect(findings.map(({subject}) => subject)).toEqual(expected);
    });

    it('helpers imported by the plugin source behave as expected', () => {
        expect(isEqual({a: 1}, {a: 1})).toBe(true);
        expect(isEqual({a: 1}, {a: 2})).toBe(false);
        expect(range(3)).toEqual([0, 1, 2]);

        jest.useFakeTimers();

        try {
            const onDebounced = jest.fn();
            const runDebounced = debounce(onDebounced, 50);
            runDebounced();
            expect(onDebounced).not.toHaveBeenCalled();
            jest.advanceTimersByTime(50);
            expect(onDebounced).toHaveBeenCalledTimes(1);

            // The plugin source reaches throttle through both the package root and the submodule path.
            for (const throttleFn of [throttle, lodashThrottle]) {
                const onThrottled = jest.fn();
                const runThrottled = throttleFn(onThrottled, 50);
                runThrottled();
                runThrottled();
                expect(onThrottled).toHaveBeenCalledTimes(1);
                jest.advanceTimersByTime(50);
                expect(onThrottled).toHaveBeenCalledTimes(2);
            }
        } finally {
            jest.useRealTimers();
        }
    });
});
