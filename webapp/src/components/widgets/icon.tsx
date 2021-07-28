// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type Props = {
    color: string;
}

const icons = require.context('src/components/assets/icons', false, /!(*icon)\.tsx$/);

console.log(icons);

const Icon = () => {

};

export default Icon;
