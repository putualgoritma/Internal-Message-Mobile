export type RootStackParamList = {
  MainTabs: undefined;
  ChatRoom: {
    conversationId?: number;
    recipientUserId?: number;
    title?: string;
  };
  NewConversation: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Chat: undefined;
  Profile: undefined;
  Notifications: undefined;
};
