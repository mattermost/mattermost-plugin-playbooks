import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {closeBackstageModal} from 'src/actions';

import {backstageModalOpen} from 'src/selectors';

import BackstageModal from './backstage_modal';

const mapStateToProps = (state: object): object => {
    return {
        show: backstageModalOpen(state),
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        close: closeBackstageModal,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(BackstageModal);
