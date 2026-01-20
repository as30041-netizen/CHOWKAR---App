import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Job } from '../types';

interface BidModalState {
    isOpen: boolean;
    jobId: string;
}

interface ViewBidsModalState {
    isOpen: boolean;
    job: Job | null;
}

interface CounterModalState {
    isOpen: boolean;
    bidId: string;
    jobId: string;
    initialAmount: string;
}

interface ProfileModalState {
    isOpen: boolean;
    userId: string;
    userName?: string;
    phoneNumber?: string;
}

interface ReviewModalState {
    isOpen: boolean;
    jobId: string;
    revieweeId: string;
    revieweeName: string;
}

interface ChatModalState {
    isOpen: boolean;
    job: Job | null;
    receiverId?: string;
}

interface ModalContextType {
    selectedJob: Job | null;
    bidModal: BidModalState;
    viewBidsModal: ViewBidsModalState;
    counterModal: CounterModalState;
    profileModal: ProfileModalState;
    reviewModal: ReviewModalState | null;
    chatModal: ChatModalState;

    // Chat List State
    chatListOpen: boolean;
    openChatList: () => void;
    closeChatList: () => void;

    showEditProfile: boolean;
    showSubscription: boolean;
    showFilterModal: boolean;

    openJobDetails: (job: Job) => void;
    closeJobDetails: () => void;

    openBidModal: (jobId: string) => void;
    closeBidModal: () => void;

    openViewBids: (job: Job) => void;
    closeViewBids: () => void;

    openCounterModal: (bidId: string, jobId: string, initialAmount: string) => void;
    closeCounterModal: () => void;

    openProfileModal: (userId: string, userName?: string, phoneNumber?: string) => void;
    closeProfileModal: () => void;

    openReviewModal: (jobId: string, revieweeId: string, revieweeName: string) => void;
    closeReviewModal: () => void;

    openChat: (job: Job, receiverId?: string) => void;
    closeChat: () => void;

    setShowEditProfile: (show: boolean) => void;
    setShowSubscription: (show: boolean) => void;

    // Filter Modal helper
    openFilterModal: () => void;
    closeFilterModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [bidModal, setBidModal] = useState<BidModalState>({ isOpen: false, jobId: '' });
    const [viewBidsModal, setViewBidsModal] = useState<ViewBidsModalState>({ isOpen: false, job: null });
    const [counterModal, setCounterModal] = useState<CounterModalState>({ isOpen: false, bidId: '', jobId: '', initialAmount: '' });
    const [profileModal, setProfileModal] = useState<ProfileModalState>({ isOpen: false, userId: '' });
    const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);
    const [chatModal, setChatModal] = useState<ChatModalState>({ isOpen: false, job: null, receiverId: undefined });
    const [chatListOpen, setChatListOpen] = useState(false);

    const [showEdit, setShowEdit] = useState(false);
    const [showSub, setShowSub] = useState(false);
    const [showFilt, setShowFilt] = useState(false);

    const openJobDetails = useCallback((job: Job) => setSelectedJob(job), []);
    const closeJobDetails = useCallback(() => setSelectedJob(null), []);

    const openBidModal = useCallback((jobId: string) => setBidModal({ isOpen: true, jobId }), []);
    const closeBidModal = useCallback(() => setBidModal(prev => ({ ...prev, isOpen: false })), []);

    const openViewBids = useCallback((job: Job) => setViewBidsModal({ isOpen: true, job }), []);
    const closeViewBids = useCallback(() => setViewBidsModal(prev => ({ ...prev, isOpen: false })), []);

    const openCounterModal = useCallback((bidId: string, jobId: string, initialAmount: string) =>
        setCounterModal({ isOpen: true, bidId, jobId, initialAmount }), []);
    const closeCounterModal = useCallback(() => setCounterModal(prev => ({ ...prev, isOpen: false })), []);

    const openProfileModal = useCallback((userId: string, userName?: string, phoneNumber?: string) =>
        setProfileModal({ isOpen: true, userId, userName, phoneNumber }), []);
    const closeProfileModal = useCallback(() => setProfileModal(prev => ({ ...prev, isOpen: false })), []);

    const openReviewModal = useCallback((jobId: string, revieweeId: string, revieweeName: string) =>
        setReviewModal({ isOpen: true, jobId, revieweeId, revieweeName }), []);
    const closeReviewModal = useCallback(() => setReviewModal(null), []);

    const openChat = useCallback((job: Job, receiverId?: string) => setChatModal({ isOpen: true, job, receiverId }), []);
    const closeChat = useCallback(() => setChatModal({ isOpen: false, job: null }), []);

    const openChatList = useCallback(() => setChatListOpen(true), []);
    const closeChatList = useCallback(() => setChatListOpen(false), []);

    const value = {
        selectedJob, bidModal, viewBidsModal, counterModal, profileModal, reviewModal, chatModal,
        chatListOpen, openChatList, closeChatList,
        showEditProfile: showEdit, setShowEditProfile: setShowEdit,
        showSubscription: showSub, setShowSubscription: setShowSub,
        showFilterModal: showFilt, openFilterModal: () => setShowFilt(true), closeFilterModal: () => setShowFilt(false),

        openJobDetails, closeJobDetails,
        openBidModal, closeBidModal,
        openViewBids, closeViewBids,
        openCounterModal, closeCounterModal,
        openProfileModal, closeProfileModal,
        openReviewModal, closeReviewModal,
        openChat, closeChat
    };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModals = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModals must be used within a ModalProvider');
    }
    return context;
};
