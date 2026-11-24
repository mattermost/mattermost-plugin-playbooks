// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../utils';

describe('playbooks > report export', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let mentionedUser;
    let testPlaybook;
    let testRun;

    // Letters, digits and spaces only, so the names survive HTML and Markdown escaping as-is.
    const suffix = getRandomId();
    const playbookTitle = `Report Export Playbook ${suffix}`;
    const runName = `Report Export Run ${suffix}`;

    const setReportsEnabled = (enabled) => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            PluginSettings: {
                Plugins: {
                    playbooks: {
                        BetaFeatures: {
                            reports: enabled,
                        },
                    },
                },
            },
        });
    };

    // The filename server/api/api_export.go builds: the title with spaces turned into
    // underscores, then the generation time in UTC.
    const expectedFilename = (title, ext) => {
        return new RegExp(`^${title.replace(/ /g, '_')}_\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}\\.${ext}$`);
    };

    // Asserts the report request and response, then yields the attachment's filename.
    const assertReportResponse = (alias, format) => {
        return cy.wait(alias).then(({request, response}) => {
            expect(new URL(request.url).searchParams.get('format')).to.equal(format);
            expect(response.statusCode).to.equal(200);

            const disposition = response.headers['content-disposition'];
            expect(disposition).to.match(/^attachment;/);

            const match = (/filename="([^"]+)"/).exec(disposition);
            expect(match, 'filename in Content-Disposition').to.not.equal(null);
            return match[1];
        });
    };

    const readDownload = (filename) => {
        return cy.readFile(`${Cypress.config('downloadsFolder')}/${filename}`);
    };

    const openRunMenu = () => {
        cy.findByTestId('run-header-section').find('h1').click();
        cy.findByTestId('dropdownmenu').should('be.visible');
    };

    // Opens "Export report" from the open menu, picks a format and, when utc is set, UTC
    // instead of the user's own time zone, then clicks Export.
    const exportFromOpenMenu = (format, utc) => {
        cy.findByTestId('dropdownmenu').findByText('Export report').click();

        cy.get('#export-options-modal').should('be.visible').within(() => {
            // * PDF is the default format, which prints instead of downloading
            cy.findByTestId('format-hint').should('be.visible');

            // # Pick the format
            cy.findByTestId(`format-button-${format}`).click();
            cy.findByTestId('format-hint').should('not.exist');

            if (utc) {
                // # Show times in UTC
                cy.findByTestId('time-zone-utc').click();
            }
        });

        // # Export
        cy.get('#export-options-modal').findByTestId('modal-confirm-button').should('have.text', 'Export').click();
    };

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateAndAddUserToTeam(team.id).then((otherUser) => {
                mentionedUser = otherUser;
            });

            cy.apiLogin(testUser);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                memberIDs: [testUser.id],
                checklists: [{
                    title: 'Stage 1',
                    items: [{title: 'Task 1'}],
                }],
            }).then((playbook) => {
                testPlaybook = playbook;

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: runName,
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;

                    // # Post a status update that mentions another user
                    cy.then(() => {
                        cy.apiUpdateStatus({
                            playbookRunId: run.id,
                            message: `Escalated to @${mentionedUser.username} for review`,
                        });
                    });
                });
            });
        });
    });

    after(() => {
        // # Restore the default: reports disabled
        setReportsEnabled(false);

        cy.apiLogin(testUser);
        if (testRun) {
            cy.apiFinishRun(testRun.id);
        }
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    describe('with reports enabled', () => {
        beforeEach(() => {
            setReportsEnabled(true);
            cy.apiLogin(testUser);
            cy.viewport('macbook-13');
        });

        it('exports a run as HTML', () => {
            cy.intercept('GET', `/plugins/playbooks/api/v0/runs/${testRun.id}/report*`).as('runReport');

            // # Open the run overview and export as HTML, with times in UTC
            cy.playbooksVisitRun(testRun.id);
            openRunMenu();
            exportFromOpenMenu('html', true);

            // * The request succeeds with an HTML attachment named after the run
            assertReportResponse('@runReport', 'html').then((filename) => {
                expect(filename).to.match(expectedFilename(runName, 'html'));

                // * The request asks for UTC
                cy.get('@runReport').its('request.url').should('contain', 'time_zone=UTC');

                // * The modal closes once the report is saved
                cy.get('#export-options-modal').should('not.exist');

                // * The downloaded file is an HTML document containing the run name
                readDownload(filename).then((html) => {
                    expect(html).to.match(/^<!DOCTYPE html>/i);
                    expect(html).to.contain(runName);

                    // * Times are shown in UTC
                    expect(html).to.contain(' UTC');
                });
            });
        });

        it('exports a run as Markdown with inert mentions', () => {
            cy.intercept('GET', `/plugins/playbooks/api/v0/runs/${testRun.id}/report*`).as('runReport');

            // # Open the run overview and export as Markdown
            cy.playbooksVisitRun(testRun.id);
            openRunMenu();
            exportFromOpenMenu('md');

            // * The request succeeds with a Markdown attachment named after the run
            assertReportResponse('@runReport', 'md').then((filename) => {
                expect(filename).to.match(expectedFilename(runName, 'md'));

                cy.get('#export-options-modal').should('not.exist');

                // * The downloaded file has the run name and the status update's mention in a code span
                readDownload(filename).then((md) => {
                    expect(md).to.contain(`# ${runName}`);
                    expect(md).to.contain(`Escalated to \`@${mentionedUser.username}\` for review`);
                    expect(md).to.not.contain(`Escalated to @${mentionedUser.username}`);
                });
            });
        });
    });

    describe('with reports disabled', () => {
        beforeEach(() => {
            setReportsEnabled(false);
            cy.apiLogin(testUser);
            cy.viewport('macbook-13');
        });

        it('hides the export in the run menu', () => {
            cy.playbooksVisitRun(testRun.id);
            openRunMenu();

            // * Other items are there, the export is not
            cy.findByTestId('dropdownmenu').findByText('Copy link').should('be.visible');
            cy.findByTestId('dropdownmenu').findByText('Export report').should('not.exist');
        });

        it('rejects report requests', () => {
            // * The report endpoint is not found while the feature is off
            cy.request({
                url: `/plugins/playbooks/api/v0/runs/${testRun.id}/report?format=html`,
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                failOnStatusCode: false,
            }).its('status').should('equal', 404);
        });
    });
});
