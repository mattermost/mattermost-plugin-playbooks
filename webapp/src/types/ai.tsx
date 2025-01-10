import React from 'react'

export type Bot = {
  id: string
}

type BotSelectorProps = {
  bots: Bot[]
  activeBot: Bot
  setActiveBot: (bot: Bot) => void
}

export type BotsLoaderHook = () => BotSelectorProps
export type BotSelector = React.FunctionComponent<BotSelectorProps>
