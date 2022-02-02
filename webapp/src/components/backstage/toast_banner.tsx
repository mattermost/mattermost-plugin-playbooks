import React, {useState, useEffect, useCallback} from 'react';
import styled from 'styled-components';

const Ctx = React.createContext({} as ToastFuncs);

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

let toastCount = 0;

interface ToastType {
    id: number;
    content: string;
    duration: number;
}

interface Props {
    children: React.ReactNode;
}

interface ToastFuncs {
    add: (content: string, duration: number) => void;
    remove: (id: number) => void;
}

const getIndexOfFirstRemovableToast = (ts: ToastType[]) => {
    for (let i = 0; i < ts.length; i++) {
        if (ts[i].duration > 0) {
            return i;
        }
    }
    return -1;
};

export const ToastProvider = (props: Props) => {
    const [toasts, setToasts] = useState<ToastType[]>([]);

    useEffect(() => {
        if (toasts.length === 0) {
            return;
        }

        const index = getIndexOfFirstRemovableToast(toasts);
        if (index >= 0) {
            window.setTimeout(() => {
                setToasts((ts) => [...ts.slice(0, index), ...ts.slice(index + 1)]);
            }, toasts[index].duration);
        }
    }, [toasts]);

    const addHelper = (content: string, duration: number) => {
        const id = toastCount++;
        const toast = {id, content, duration};
        setToasts((ts) => [...ts, toast]);
    };

    // do not recreate every time
    const add = useCallback(
        addHelper,
        [setToasts]
    );

    const remove = (id: number) => {
        setToasts((ts) => ts.filter((t: ToastType) => t.id !== id));
    };

    const onDismiss = (id: number) => () => remove(id);

    return (
        <Ctx.Provider value={{add, remove}}>
            {props.children}
            <ToastContainer>
                {
                    toasts.map(({content, id, ...rest}) => (
                        <StyledToast
                            key={id}
                            {...rest}
                        >
                            <StyledCheck className={'icon icon-check'}/>
                            <StyledText>{content}</StyledText>
                            <StyledClose
                                className={'icon icon-close'}
                                onClick={onDismiss(id)}
                            />
                        </StyledToast>
                    ))
                }
            </ToastContainer >
        </Ctx.Provider >
    );
};

export const useToasts = () => React.useContext(Ctx);
