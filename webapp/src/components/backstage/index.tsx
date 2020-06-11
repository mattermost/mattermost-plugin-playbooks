import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {navigateToUrl, navigateToTeamPluginUrl} from 'src/actions';
import {backstage} from 'src/selectors';

import {Backstage, Props} from './backstage';

const mapStateToProps = (state: GlobalState, ownProps: Props): object => {
    const currentTeam = getCurrentTeam(state);

    return {
        selectedArea: ownProps.selectedArea || backstage(state).selectedArea,
        currentTeamId: currentTeam.id,
        currentTeamName: currentTeam.name,
        currentTeamDisplayName: currentTeam.display_name,
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        navigateToUrl,
        navigateToTeamPluginUrl,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(Backstage);
