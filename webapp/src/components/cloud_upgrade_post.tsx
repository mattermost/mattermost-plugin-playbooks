import React from 'react';
import {useDispatch} from 'react-redux';

import styled from 'styled-components';

import {Post} from 'mattermost-redux/types/posts';
import {Theme} from 'mattermost-redux/types/preferences';

import UpgradeIllustrationSvg from 'src/components/assets/upgrade_illustration_svg';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import PostText from 'src/components/post_text';
import {CustomPostContainer, CustomPostContent, CustomPostHeader, CustomPostButtonRow} from 'src/components/custom_post_styles';
import {useOpenCloudModal} from 'src/hooks';

const StyledTertiaryButton = styled(TertiaryButton)`
    margin-left: 10px;
`;

interface Props {
    post: Post;
}

export const CloudUpgradePost = (props: Props) => {
    const openCloudModal = useOpenCloudModal();
    const attachments = props.post.props.attachments[0];

    // Remove the footer (which starts with the Upgrade now link),
    // that is the fallback for mobile
    const text = attachments.text.split('[Upgrade now]')[0];

    return (
        <>
            <StyledPostText text={props.post.message}/>
            <CustomPostContainer>
                <CustomPostContent>
                    <CustomPostHeader>
                        {attachments.title}
                    </CustomPostHeader>
                    <TextBody>
                        {text}
                    </TextBody>
                    <CustomPostButtonRow>
                        <PrimaryButton onClick={openCloudModal} >
                            {'Upgrade now'}
                        </PrimaryButton>
                        <StyledTertiaryButton
                            onClick={() => window.open('https://mattermost.com/pricing-cloud')}
                        >
                            {'Learn more'}
                        </StyledTertiaryButton>
                    </CustomPostButtonRow>
                </CustomPostContent>
                <Image/>
            </CustomPostContainer>
        </>
    );
};

const Image = styled(UpgradeIllustrationSvg)`
    width: 175px;
    height: 106px;
    margin: 16px;
`;

const TextBody = styled.div`
    width: 396px;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
