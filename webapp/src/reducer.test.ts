import {
    REMOVED_FROM_INCIDENT_CHANNEL,
} from 'src/types/actions';
import reducer from 'src/reducer';

describe('myIncidentsByTeam', () => {
    // @ts-ignore
    const initialState = reducer(undefined, {}); // eslint-disable-line no-undefined

    describe('REMOVED_FROM_INCIDENT_CHANNEL', () => {
        const makeState = (myIncidentsByTeam: any) => ({
            ...initialState,
            myIncidentsByTeam,
        });

        it('should ignore a channel not in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'incidentId1'},
                    channelId2: {id: 'incidentId2'},
                },
                teamId2: {
                    channelId3: {id: 'incidentId3'},
                    channelId4: {id: 'incidentId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_INCIDENT_CHANNEL,
                channelId: 'unknown',
            };
            const expectedState = state;

            // @ts-ignore
            expect(reducer(state, action)).toStrictEqual(expectedState);
        });

        it('should remove a channel in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'incidentId1'},
                    channelId2: {id: 'incidentId2'},
                },
                teamId2: {
                    channelId3: {id: 'incidentId3'},
                    channelId4: {id: 'incidentId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_INCIDENT_CHANNEL,
                channelId: 'channelId2',
            };
            const expectedState = makeState({
                teamId1: {
                    channelId1: {id: 'incidentId1'},
                },
                teamId2: {
                    channelId3: {id: 'incidentId3'},
                    channelId4: {id: 'incidentId4'},
                },
            });

            // @ts-ignore
            expect(reducer(state, action)).toEqual(expectedState);
        });
    });
});
