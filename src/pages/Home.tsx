import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfigForm } from '../components/ConfigForm';
import type { MusicParams } from '../engine/MusicGenerator';

export const Home: React.FC = () => {
    const navigate = useNavigate();

    const handleStart = (params: MusicParams) => {
        navigate('/practice', { state: { params } });
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1f2937 0%, #111827 100%)'
        }}>
            <ConfigForm onStart={handleStart} />
        </div>
    );
};
