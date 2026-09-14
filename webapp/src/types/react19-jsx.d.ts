// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSX as ReactJSX} from 'react';

// React 19 moved the JSX namespace onto React. Restore the global alias so
// styled-components v5 types and existing JSX.Element annotations still typecheck.
declare global {
    namespace JSX {
        type ElementType = ReactJSX.ElementType;
        type Element = ReactJSX.Element;
        type ElementClass = ReactJSX.ElementClass;
        type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
        type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
        type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
        interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
        interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
        interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
    }
}

export {};
