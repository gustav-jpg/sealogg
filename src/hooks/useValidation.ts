import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  CrewRole,
  CREW_ROLE_LABELS,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '@/lib/types';

interface CrewMember {
  userId: string;
  role: CrewRole;
  fullName: string;
}

interface UseValidationProps {
  vesselId: string | null;
  crew: CrewMember[];
  enabled?: boolean;
}

export function useValidation({ vesselId, crew, enabled = true }: UseValidationProps) {
  // Fetch vessel crew requirements (minimum crew counts)
  const { data: requirements } = useQuery({
    queryKey: ['vessel-crew-requirements', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const { data, error } = await supabase
        .from('vessel_crew_requirements')
        .select('*')
        .eq('vessel_id', vesselId);
      if (error) throw error;
      return data;
    },
    enabled: !!vesselId && enabled,
  });

  // Fetch vessel-specific certificate rules
  const { data: vesselRules } = useQuery({
    queryKey: ['vessel-role-certificates', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const { data, error } = await supabase
        .from('vessel_role_certificates')
        .select('*, certificate_type:certificate_types(*)')
        .eq('vessel_id', vesselId);
      if (error) throw error;
      return data;
    },
    enabled: !!vesselId && enabled,
  });

  // Fetch certificates for crew members
  const crewProfileIds = crew.map(c => c.userId);
  const { data: certificates } = useQuery({
    queryKey: ['user-certificates', crewProfileIds],
    queryFn: async () => {
      if (crewProfileIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_certificates')
        .select('*, certificate_type:certificate_types(*)')
        .in('profile_id', crewProfileIds);
      if (error) throw error;
      return data;
    },
    enabled: crewProfileIds.length > 0 && enabled,
  });

  // Fetch inductions for crew members
  const { data: inductions } = useQuery({
    queryKey: ['user-inductions', vesselId, crewProfileIds],
    queryFn: async () => {
      if (!vesselId || crewProfileIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_vessel_inductions')
        .select('*')
        .eq('vessel_id', vesselId)
        .in('profile_id', crewProfileIds);
      if (error) throw error;
      return data;
    },
    enabled: !!vesselId && crewProfileIds.length > 0 && enabled,
  });

  const validation = useMemo<ValidationResult>(() => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!vesselId) {
      return { isValid: false, errors: [], warnings: [], noVesselSelected: true };
    }

    // Check crew requirements
    if (requirements) {
      for (const req of requirements) {
        const crewCount = crew.filter(c => c.role === req.role).length;
        if (crewCount < req.minimum_count) {
          errors.push({
            type: 'crew_requirement',
            message: `Fartyget kräver minst ${req.minimum_count} ${CREW_ROLE_LABELS[req.role as CrewRole]} – du har ${crewCount}.`,
          });
        }
      }
    }

    // Check certificates and inductions for each crew member
    const today = new Date().toISOString().split('T')[0];
    const warningDate = new Date();
    warningDate.setMonth(warningDate.getMonth() + 2);
    const warningDateStr = warningDate.toISOString().split('T')[0];

    for (const member of crew) {
      const memberCerts = certificates?.filter(c => c.profile_id === member.userId) || [];
      const hasInduction = inductions?.some(i => i.profile_id === member.userId);

      // All crew members need induction
      if (!hasInduction) {
        errors.push({
          type: 'induction',
          message: `${member.fullName} är inte inskolad på detta fartyg.`,
        });
      }

      // Get certificate rules for this role on this vessel
      const memberRules = vesselRules?.filter(r => r.role === member.role) || [];

      // Group rules by group_name for OR logic
      const groupedRules: Record<string, typeof memberRules> = {};
      const standaloneRules: typeof memberRules = [];

      for (const rule of memberRules) {
        if (rule.group_name) {
          if (!groupedRules[rule.group_name]) {
            groupedRules[rule.group_name] = [];
          }
          groupedRules[rule.group_name].push(rule);
        } else {
          standaloneRules.push(rule);
        }
      }

      // Check standalone (AND) requirements
      for (const rule of standaloneRules) {
        const cert = memberCerts.find(
          c => c.certificate_type_id === rule.certificate_type_id
        );

        if (!cert) {
          const certName = (rule as any).certificate_type?.name || 'okänt certifikat';
          errors.push({
            type: 'certificate',
            message: `${member.fullName} saknar ${certName}.`,
          });
        } else if (cert.expiry_date < today) {
          const certName = (rule as any).certificate_type?.name || 'certifikat';
          errors.push({
            type: 'certificate',
            message: `${member.fullName} har utgånget ${certName} (utgick ${cert.expiry_date}).`,
          });
        } else if (cert.expiry_date <= warningDateStr) {
          const certName = (rule as any).certificate_type?.name || 'certifikat';
          warnings.push({
            type: 'certificate_expiring',
            message: `${member.fullName}s ${certName} går ut ${cert.expiry_date}.`,
          });
        }
      }

      // Check grouped (OR) requirements
      for (const [groupName, groupRules] of Object.entries(groupedRules)) {
        const hasValidCert = groupRules.some(rule => {
          const cert = memberCerts.find(
            c => c.certificate_type_id === rule.certificate_type_id
          );
          return cert && cert.expiry_date >= today;
        });

        if (!hasValidCert) {
          const certNames = groupRules
            .map(r => (r as any).certificate_type?.name)
            .filter(Boolean)
            .join(' eller ');
          errors.push({
            type: 'certificate',
            message: `${member.fullName} saknar giltig ${certNames}.`,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [vesselId, crew, requirements, vesselRules, certificates, inductions]);

  return validation;
}
