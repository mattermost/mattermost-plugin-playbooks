import React, {useState} from 'react';
import styled from 'styled-components';
import {CSSTransition, TransitionGroup} from 'react-transition-group';

import {Toast, ToastProps} from './toast';

const Ctx = React.createContext({} as ToastFuncs);

const DEFAULT_DURATION = 3000;
let toastCount = 0;

const ToastContainer = styled.div`
    position: fixed;
    left: 50%;
    bottom: 36px;
    transform: translate(-50%);
    z-index: 1;
    width: max-content;
    max-width: 95%;
`;

interface Props {
    children: React.ReactNode;
}

interface ToastOptions extends ToastProps {
    duration?: number;
}

interface ToastOptionsWithID extends ToastOptions {
    id: number
}

interface ToastFuncs {
    add: (options: ToastOptions) => number;
    remove: (id: number) => void;
}

export const ToastProvider = (props: Props) => {
    const [toasts, setToasts] = useState<ToastOptionsWithID[]>([]);

    const add = (options: ToastOptions) => {
        const id = toastCount++;
        const duration = options.duration ?? DEFAULT_DURATION;

        setToasts((ts) => [...ts, {id, ...options}]);
        if (duration <= 0) {
            return id;
        }

        window.setTimeout(() => {
            setToasts((ts) => {
                const index = ts.findIndex((t) => t.id === id);
                if (index === -1) {
                    return ts;
                }
                return [...ts.slice(0, index), ...ts.slice(index + 1)];
            });
        }, duration);

        return id;
    };

    const remove = (id: number) => {
        setToasts((ts) => ts.filter((t: ToastOptionsWithID) => t.id !== id));
    };

    return (
        <Ctx.Provider value={{add, remove}}>
            {props.children}
            <TransitionGroup component={ToastContainer}>
                {
                    toasts.map((options: ToastOptionsWithID) => {
                        return (
                            <CSSTransition
                                key={options.id}
                                classNames='fade'
                                timeout={500}
                            >
                                <Toast
                                    {...options}
                                    closeCallback={() => {
                                        remove(options.id);
                                        options.closeCallback?.();
                                    }}
                                />
                            </CSSTransition>
                        );
                    })
                }
            </TransitionGroup>
        </Ctx.Provider>
    );
};

// ╬╬╬╬╬╬╬╬╣╣╬╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╬╬╬╬╬╬╬╬╬╬╬╬╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣╣▓╝▀╙▀╝╣╣╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╬╬╬╬╬╬╬╬╬╬╬╬╣╬╬╣╬╬╣╣╣╣╣╣╣╣╣╣▓╝╙╙╙╜╩╣▒└╓╗@Q╗▄▄,╙╣╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╬╬╬╬╬╬╬╬╬╬╬╬╬╣╬╣╣╣╣╣╣╣╣▒;╓╗▓▓▄▄▄, 7╣╢╫▓▓▓▓▓o ╙╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╬╬╬╬╬╬╬╬╬╬╬╬╬╬╬╣╬╣╣╬╣╬░@▓▓▓▓▓▓█▓▄ "╠╠╩╬║▓▓▓Q ╙╬╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╠╠╬╬╬╬╬╬╬╬╬╬╬╬╣╬╩╚╚╩╙╙]║▓▓█▓▓▓█▓██^^░╚╠╠╠▓▓▓ε ║╣╬╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╠╠╬╬╬╬╬╬╬╬╬╬╩░└░░"=-░7╚╙╢║╣╬▓▓▓▓▓▓▌.╚╚░╚╠╠╣▓▒ ░╙╚╣╣╣╣╣╣╣╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╠╠╠╠╠╬╬╬╬╬╣▒░░░░░φ=; ^` -╙╩╚╝║▓▓▓▓▓▒ ░φφ▒░╠╣▀φ░╠φ/╙╚╬╬╬╠╬╬╬╬╣╣╣╣▓▓▓▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╠╠╠╠╠╠╬╠╬╬▒░░░░░░░░░░φα,'"  ╙╠╚╚╢╣▓▒╔φ╠╠φ╠╠▒▒╝╜╙╙░α-└╙╬╠╠╠╬╬╬╬╬╠╣╣╣▓▓▓▓▓▓▓▓
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╬╠▒░░░░░░░░░░░░░░Ç^^" └╚φφφφΣ╝╩╙╙╙└  ⁿ"-""ⁿ"ⁿⁿ░║╠╠╠╬╬╬╬╬╬╬╬╬╣╣▓▓▓▓▓
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╬▒░░░░░░░░░░░░░░░░≈;-- └╙┘░-   ^,---;""";;░░░░░╠╠╠╠╬╬╠╬╬╬╬╬╬╬╣╣▓▓▓
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒░░░░░░░░░░░░░░░░░░≈░φ∩,------;;░="▄   ^²φφφ░░░╠╠╠╠╬╬╠╬╬╬╬╬╬╬╠╣▓▓
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒░░░░░░░░░░░░░░░░░░░╙░╣▒░░░└░░░░^  ╠╠     ░╚░░░╚╠╠╠╠╠╠╠╠╠╬╬╬╬╬╠╣╣
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒░░░░░░░░░░░░░░░░░░░░╙╩╩░░░░░░░⌐,╓ ╠╠     '""' ]╠╠╠╠╠╠╠╠╠╠╬╬╠╠╬╠╠
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒░░░░░░░░░░░░░░░░░░░░░╘░░░ⁿ""-^"╙ φ░▄▄▄;       ]╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒░░░░░░░░░░░░░░░░░░░░░░¼^" '     ▒▒▓▓█▒▒▒      :╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠▒φ░░░░░░░░░░░░░░░░░░░░░▐          ▒█▒▒▒        :╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠╠╠╠╠╠╠░░░▒░φ░░░░░░░░░░░░░░░░░░░∩░           ▐░          :╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠╠╠╠╠╠╠░░░▒φφ░░░░░░░░░░░φ╔φφ╠╠▒╠φφ           ▐▒ ~        "╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠╠╠╠╠φ▒φ▓╣╣╬╠▒░░╚╠░╠φ╠╠φ╠╠╠╠╠╠╠╠╠╠⌐           ▒          "░╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠╠
// ╠╠╠╠╠╠φφ╣▓▓▓▓▓▓▓╣╬╬╠▒░░╙╠╠╠║╠╠╠╠╠╠╠╠╬╬╠░           ▒ ╓≡ "     «╣╣▓▒φ▒▒░╠╠╠╠╠╠╠╠╠
// ╠╠▒φ▓▓╣▓▓▓▓▓▓▓▓▓▓▓╣╣╬╣▒φφ░╙╠╠╠╠╣╣╣╬╠╢╬╠▒    "╓▄æ╓    σ≤ └    -╓╣▓▓▓▓▓▓▓╣▓▓▓▄▄▒╠╠
// ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╣╣╣╣╬▒▒φ░╙╚╠║╬╬╣╣╣▒▒    ╠╙▒╦▓▒⌐  ╓≡⌐└',;]φ▓╣▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
// ▓▓▓▓▓▓▓▓▓▓▓▓▓█▓▓█▓▓▓▓▓▓▓▓╣▒▒▒φφ░└╙╙╣╣╬╠▒░-"░▀░▓▀░░O,,--»░╔φ╣╣╣▓▓▓▓▓████████▓▓█▀╠
// ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▓▓███▓▓▓▓▓▓▓▓▒╣▒▒φφ░░│╚░░░»αⁿ:╙∩Γ└░╓╓φφ╣╣╣╣╣▓▓▓█████████████╬╠╣╣
// ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████▓▓████▓█▓▓▓▓▓▓▓▓▒▒φφ░░░░░░░╓φφ▒╣╣▓▓▓▓▓▓▓███████████████╠╬▒╣╣╣
// ╠╠║▓▓██▓▓█▓██▓████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓██████████████████████████╬▒▓╣╬╣▒╣
export const useToaster = () => React.useContext(Ctx);
