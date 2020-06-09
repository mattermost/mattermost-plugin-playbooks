import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setBackstage, historyBack, navigateToTeamPluginUrl} from 'src/actions';
import {backstage} from 'src/selectors';
import {BackstageArea} from 'src/types/backstage';

import Backstage from './backstage';

const mapStateToProps = (state: object, ownProps): object => {
    const currentTeam = getCurrentTeam(state);

    return {
        selectedArea: ownProps.selectedArea || backstage(state).selectedArea,
        currentTeamId: currentTeam.id,
        currentTeamName: currentTeam.display_name,
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        onBack: () => historyBack(),
        navigateToTeamPluginUrl,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(Backstage);
