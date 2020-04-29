import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getPlaybooksForCurrentTeam} from 'src/actions';

import {playbooks} from 'src/selectors';

import PlaybookList from './playbook_list';

const mapStateToProps = (state: object): object => {
    const currentTeamID = getCurrentTeamId(state);

    return {
        playbooks: playbooks(state)[currentTeamID] || [],
        currentTeamID,
    };
};
const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        getPlaybooksForCurrentTeam,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(PlaybookList);
