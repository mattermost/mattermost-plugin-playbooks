import React from 'react';
import {FormattedMessage} from 'react-intl';

import MattermostLogo from 'src/components/assets/mattermost_logo_svg';
import {FilesOverlayImage} from 'src/components/assets/files_overlay_image';

export interface FileUploadOverlayProps {
    show: boolean;
    overlayType: string;
}
export const FileUploadOverlay = (props: FileUploadOverlayProps) => {
    let overlayClass = 'file-overlay';
    if (!props.show) {
        overlayClass += ' hidden';
    }
    if (props.overlayType === 'right') {
        overlayClass += ' right-file-overlay';
    } else if (props.overlayType === 'center') {
        overlayClass += ' center-file-overlay';
    }

    return (
        <div className={overlayClass}>
            <div className='overlay__indent'>
                <div className='overlay__circle'>
                    <FilesOverlayImage
                        className='overlay__files'
                        alt={'Files'}
                    />
                    <span>
                        <i className='fa fa-upload'/>
                        <FormattedMessage
                            defaultMessage='Drop a file to upload it.'
                        />
                    </span>
                    <MattermostLogo
                        className='overlay__logo'
                        fill='#ffffff'
                        width='100'
                        height='16'
                    />
                </div>
            </div>
        </div>
    );
};
