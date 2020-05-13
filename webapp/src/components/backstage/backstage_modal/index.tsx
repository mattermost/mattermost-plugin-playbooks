import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setBackstageModal} from 'src/actions';
import {backstageModal} from 'src/selectors';
import {BackstageArea} from 'src/types/backstage';

import BackstageModal from './backstage_modal';

const mapStateToProps = (state: object): object => {
    const currentTeam = getCurrentTeam(state);

    return {
        show: backstageModal(state).open,
        selectedArea: backstageModal(state).selectedArea,
        currentTeamId: currentTeam.id,
        currentTeamName: currentTeam.display_name,
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        close: () => setBackstageModal(false),
        setSelectedArea: (selectedArea: BackstageArea) => setBackstageModal(true, selectedArea),
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(BackstageModal);
