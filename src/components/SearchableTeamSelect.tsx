/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { Team, COPA_2026_TEAMS } from '../data/teams';

interface SearchableTeamSelectProps {
  selectedTeamCode: string | null;
  onChange: (teamCode: string) => void;
  disabledTeams?: string[];
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableTeamSelect({
  selectedTeamCode,
  onChange,
  disabledTeams = [],
  placeholder = 'Selecione uma seleção...',
  disabled = false
}: SearchableTeamSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Find currently selected team details
  const selectedTeam = COPA_2026_TEAMS.find(t => t.code === selectedTeamCode);

  // Filter teams list based on search input
  const filteredTeams = COPA_2026_TEAMS.filter(team => {
    const searchLower = searchText.toLowerCase();
    return (
      team.name.toLowerCase().includes(searchLower) ||
      team.code.toLowerCase().includes(searchLower) ||
      team.group.toLowerCase().includes(searchLower)
    );
  });

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search text when opening/closing
  useEffect(() => {
    if (isOpen) {
      setSearchText('');
    }
  }, [isOpen]);

  const handleSelect = (teamCode: string) => {
    if (disabledTeams.includes(teamCode)) return;
    onChange(teamCode);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button/Input UI */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[48px] px-4 py-2.5 bg-[#090C10] border border-[#1F2937] text-on-surface rounded-lg flex items-center justify-between text-left transition-all ${
          disabled 
            ? 'opacity-75 cursor-not-allowed' 
            : 'hover:border-[#00E676] focus:border-[#00E676] focus:ring-1 focus:ring-[#00e676]'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selectedTeam ? (
            <>
              <span className="text-xl select-none leading-none">{selectedTeam.flag}</span>
              <span className="font-semibold text-xs text-white truncate">{selectedTeam.name}</span>
              <span className="font-mono text-[9px] text-on-surface-variant bg-[#161B22] px-1 py-0.2 rounded font-bold">{selectedTeam.code}</span>
            </>
          ) : (
            <span className="text-xs text-[#3d4756] font-medium">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {selectedTeam && !disabled && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-full hover:bg-surface-variant/40 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-185' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161B22] border border-[#313d4c] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]">
          {/* Search Header */}
          <div className="p-2.5 border-b border-[#313d4c]/65 flex items-center gap-2 bg-[#0D1117]">
            <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar país ou sigla..."
              className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder:text-gray-600 h-8 font-medium"
              autoFocus
            />
          </div>

          {/* Teams List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#313d4c]/30 scrollbar-none">
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => {
                const isSelected = team.code === selectedTeamCode;
                const isAlreadySelectedElsewhere = disabledTeams.includes(team.code) && !isSelected;

                return (
                  <button
                    key={team.code}
                    type="button"
                    disabled={isAlreadySelectedElsewhere}
                    onClick={() => handleSelect(team.code)}
                    className={`w-full px-4 py-3 flex items-center justify-between text-left text-xs transition-colors ${
                      isSelected 
                        ? 'bg-[#00e676]/10 text-white font-bold' 
                        : isAlreadySelectedElsewhere
                          ? 'opacity-40 bg-[#090C10]/40 cursor-not-allowed'
                          : 'hover:bg-[#1f2937]/50 text-[#dfe2eb]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base select-none leading-none shrink-0">{team.flag}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{team.name}</span>
                        <span className="text-[9px] text-on-surface-variant font-mono">{team.group}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <span className="font-mono text-[9px] text-on-surface-variant bg-[#090C10] px-1 py-0.2 rounded font-bold">{team.code}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#00E676] shrink-0" />}
                      {isAlreadySelectedElsewhere && (
                        <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider leading-none">
                          Já Escolhido
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-on-surface-variant font-medium">
                Nenhuma seleção localizada...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
