import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getPlaybooksForCurrentTeam} from 'src/actions';

import {playbooksForTeam} from 'src/selectors';

import PlaybookList from './playbook_list';

const mapStateToProps = (state: object): object => {
    const currentTeam = getCurrentTeam(state);
    return {
        playbooks: playbooksForTeam(state) || [],
        currentTeam,
    };
};
const mapDispatchToProps = (dispatch: Dispatch): object => {
    return {
        actions: bindActionCreators({
            getPlaybooksForCurrentTeam,
        }, dispatch),
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(PlaybookList));
