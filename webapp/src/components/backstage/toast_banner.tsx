import React, {useState} from 'react';
import styled from 'styled-components';
import {CSSTransition, TransitionGroup} from 'react-transition-group';

const Ctx = React.createContext({} as ToastFuncs);

const DEFAULT_DURATION = 2000;
let toastCount = 0;

const StyledToast = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 4px 4px 4px 12px;
    margin: 4px;
    height: 40px;

    background: var(--center-channel-color);
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

    &.fade-enter {
        transform: translateY(80px);
    }
  
    &.fade-enter-active {
        transform: translateY(0);
        transition: 0.5s cubic-bezier(0.44, 0.13, 0.42, 1.43);
    }
  
    &.fade-exit {
        transform: translateY(0);
    }
  
    &.fade-exit-active {
        transform: translateY(280px);
        transition: transform 0.75s cubic-bezier(0.59, -0.23, 0.42, 1.43);
    }
`;

const StyledText = styled.div`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;

    display: flex;
    align-items: center;
    text-align: center;

    margin: 0px 8px;
    
    color: var(--sidebar-text);
`;

const ToastContainer = styled.div`
    position: fixed;
    left: 50%;
    bottom: 36px;
    transform: translate(-50%);
    z-index: 1;
`;

const StyledCheck = styled.i`
    color: var(--sidebar-text);
`;

const StyledClose = styled.i`
    color: var(--sidebar-text-60);
`;

interface ToastType {
    id: number;
    content: string;
    duration: number;
}

interface Props {
    children: React.ReactNode;
}

interface ToastFuncs {
    add: (content: string, duration?: number) => void;
    remove: (id: number) => void;
}

export const ToastProvider = (props: Props) => {
    const [toasts, setToasts] = useState<ToastType[]>([]);

    const add = (content: string, duration: number = DEFAULT_DURATION) => {
        const id = toastCount++;
        const toast = {id, content, duration};
        setToasts((ts) => [...ts, toast]);
        if (duration <= 0) {
            return;
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
    };

    const remove = (id: number) => {
        setToasts((ts) => ts.filter((t: ToastType) => t.id !== id));
    };

    const onDismiss = (id: number) => () => remove(id);

    return (
        <Ctx.Provider value={{add, remove}}>
            {props.children}
            <TransitionGroup component={ToastContainer}>
                {
                    toasts.map(({content, id, ...rest}) => (
                        <CSSTransition
                            key={id}
                            classNames='fade'
                            timeout={2000}
                        >
                            <StyledToast
                                {...rest}
                            >
                                <StyledCheck className={'icon icon-check'}/>
                                <StyledText>{content}</StyledText>
                                <StyledClose
                                    className={'icon icon-close'}
                                    onClick={onDismiss(id)}
                                />
                            </StyledToast>
                        </CSSTransition>
                    ))
                }
            </TransitionGroup>
        </Ctx.Provider >
    );
};

export const useToasts = () => React.useContext(Ctx);
