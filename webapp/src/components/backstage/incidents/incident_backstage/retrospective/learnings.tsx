// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Incident} from 'src/types/incident';
import {useProfilesInChannel} from 'src/hooks';
import ProfileVertical
    from 'src/components/backstage/incidents/incident_backstage/retrospective/profile_vertical';
import {
    Content,
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const StyledContent = styled(Content)`
    padding: 8px;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1px 10fr 1px 10fr 1px 10fr;
    grid-template-rows: auto 1px auto 1px auto 1px auto;
`;

const Line = styled.div`
    background: grey;
`;

const Cell = styled.div`
    padding: 8px;
`;

const ColTitle = styled.div`
    padding: 8px;
    font-weight: 600;
`;

const Learnings = (props: {incident: Incident}) => {
    const profilesInChannel = useProfilesInChannel(props.incident.channel_id);
    const profilesExceptCommander = profilesInChannel.filter((u) => u.id !== props.incident.commander_user_id);
    const second = profilesExceptCommander[1];
    const third = profilesExceptCommander[2];

    return (
        <TabPageContainer>
            <Header>
                <Title>{'Learnings'}</Title>
                <SecondaryButtonRight>{'Collect Responses'}</SecondaryButtonRight>
            </Header>
            <StyledContent>
                <Grid>
                    <Cell/>
                    <Line/>
                    <ColTitle>{'What went well?'}</ColTitle>
                    <Line/>
                    <ColTitle>{'What could have gone better?'}</ColTitle>
                    <Line/>
                    <ColTitle>{'What should we do differently next time?'}</ColTitle>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>

                    <Cell><ProfileVertical userId={props.incident.commander_user_id}/></Cell>
                    <Line/>
                    <Cell>{'Sed venenatis massa laoreet ex tristique, quis suscipit ante aliquam. Nulla dignissim, justo vel finibus malesuada, turpis dui hendrerit elit, at ultrices libero libero faucibus odio.'}</Cell>
                    <Line/>
                    <Cell>{'Maecenas ac neque sed leo mattis faucibus eget nec ex. Duis pharetra nisi quis nulla sodales auctor.'}</Cell>
                    <Line/>
                    <Cell>{'Sed id velit vitae sapien mattis fringilla nec ac neque. Mauris rhoncus pellentesque libero. Nullam vitae magna tortor.'}</Cell>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>

                    <Cell><ProfileVertical userId={second.id}/></Cell>
                    <Line/>
                    <Cell>{'In viverra eros sit amet est tincidunt malesuada.'}</Cell>
                    <Line/>
                    <Cell>{'Donec id ipsum in lorem lacinia rhoncus quis id urna. Cras rhoncus faucibus sem eget ornare.'}</Cell>
                    <Line/>
                    <Cell>{'Aenean augue magna, consequat eu porttitor vel, fringilla a purus. Proin fermentum lacus at efficitur elementum. Aenean a mollis nunc.'}</Cell>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>

                    <Cell><ProfileVertical userId={third.id}/></Cell>
                    <Line/>
                    <Cell>{'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed mauris dui, imperdiet quis rutrum eget, lobortis a mauris.'}</Cell>
                    <Line/>
                    <Cell>{'Morbi vitae consectetur nisl, eu finibus odio. Duis nec finibus elit. Donec magna nisl, aliquam nec odio id, condimentum convallis augue.'}</Cell>
                    <Line/>
                    <Cell>{'Vivamus vestibulum nisi ut sapien pharetra, quis elementum enim tincidunt. Nulla et massa egestas, fringilla augue nec, interdum metus.'}</Cell>
                </Grid>
            </StyledContent>
        </TabPageContainer>
    );
};

export default Learnings;
