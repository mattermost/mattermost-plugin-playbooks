import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setBackstage, navigateToUrl, navigateToTeamPluginUrl} from 'src/actions';
import {backstage} from 'src/selectors';
import {BackstageArea} from 'src/types/backstage';

import Backstage from './backstage';

const mapStateToProps = (state: object, ownProps): object => {
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
