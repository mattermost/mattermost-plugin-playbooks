import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {closePlaybooksModal} from 'src/actions';

import {playbookModalOpen} from 'src/selectors';

import ConfigurePlaybookModal from './configure_playbook';

const mapStateToProps = (state: object): object => {
    return {
        visible: playbookModalOpen(state),
        playbook: {title: ''},
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        close: closePlaybooksModal,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(ConfigurePlaybookModal);
