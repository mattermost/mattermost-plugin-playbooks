import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {closePlaybooksModal, fetchPlaybooks} from 'src/actions';

import {playbookModalOpen, playbooks} from 'src/selectors';

import ConfigurePlaybookModal from './configure_playbook';

const mapStateToProps = (state: object): object => {
    return {
        visible: playbookModalOpen(state),
        playbook: playbooks(state)?.length > 0 ? playbooks(state)[0] : null,
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        close: closePlaybooksModal,
        fetchPlaybooks,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(ConfigurePlaybookModal);
