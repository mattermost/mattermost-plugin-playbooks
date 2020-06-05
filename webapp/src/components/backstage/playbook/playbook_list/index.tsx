import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getPlaybooksForCurrentTeam} from 'src/actions';

import {playbooksForTeam} from 'src/selectors';

import PlaybookList from './playbook_list';

const mapStateToProps = (state: object): object => {
    const currentTeam = getCurrentTeam(state);
    const currentTeamID = currentTeam.id;
    const currentTeamName = currentTeam.display_name;

    return {
        playbooks: playbooksForTeam(state) || [],
        currentTeamName,
        currentTeamID,
    };
};
const mapDispatchToProps = (dispatch: Dispatch): object => {
    return {
        actions: bindActionCreators({
            getPlaybooksForCurrentTeam,
        }, dispatch),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PlaybookList);
