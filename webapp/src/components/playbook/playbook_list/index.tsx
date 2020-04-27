import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {fetchPlaybooks} from 'src/actions';

import {playbooks} from 'src/selectors';

import PlaybookList from './playbook_list';

const mapStateToProps = (state: object): object => {
    return {
        playbooks: playbooks(state),
    };
};
const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        fetchPlaybooks,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(PlaybookList);
