import {UserProfile} from 'mattermost-redux/types/users';

export const getDisplayName = (user: UserProfile): string => {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    }

    return `@${user.username}`;
};
