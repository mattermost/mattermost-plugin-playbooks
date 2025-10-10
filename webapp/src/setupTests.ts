// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock ReactBootstrap for Jest tests
const mockComponent = () => null;

(global as any).ReactBootstrap = {
    Modal: Object.assign(mockComponent, {
        Header: mockComponent,
        Body: mockComponent,
        Footer: mockComponent,
        Title: mockComponent,
        Dialog: mockComponent,
    }),
    Button: mockComponent,
    Form: mockComponent,
    InputGroup: mockComponent,
    FormControl: mockComponent,
    Dropdown: mockComponent,
    DropdownButton: mockComponent,
    DropdownToggle: mockComponent,
    DropdownMenu: mockComponent,
    DropdownItem: mockComponent,
    Nav: mockComponent,
    NavItem: mockComponent,
    NavLink: mockComponent,
    NavDropdown: mockComponent,
    Tabs: mockComponent,
    Tab: mockComponent,
    Row: mockComponent,
    Col: mockComponent,
    Container: mockComponent,
    Card: mockComponent,
    CardHeader: mockComponent,
    CardBody: mockComponent,
    CardFooter: mockComponent,
    Badge: mockComponent,
    Alert: mockComponent,
    Spinner: mockComponent,
    OverlayTrigger: mockComponent,
    Tooltip: mockComponent,
    Popover: mockComponent,
};
