import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listStaffProfiles,
  upsertStaffProfile,
  updateStaffStatus,
  listStaffLeaves,
  reviewLeaveRequest,
  listStaffSalaries,
  markSalaryPaid,
  grantStaffLeave,
} from '../api/staff.api';
import { getPersistentCache } from '@/shared/lib/cachePersistence';

const STAFF_QUERY_KEYS = {
  allProfiles: ['staff', 'profiles'],
  leaves: (status) => ['staff', 'leaves', { status }],
  salaries: (monthYear) => ['staff', 'salaries', { monthYear }],
};

export function useStaffProfiles() {
  return useQuery({
    queryKey: STAFF_QUERY_KEYS.allProfiles,
    queryFn: listStaffProfiles,
    placeholderData: () => getPersistentCache('staff_profiles') || undefined,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

export function useUpsertStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertStaffProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allProfiles });
    },
  });
}

export function useUpdateStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, status }) => updateStaffStatus(staffId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allProfiles });
    },
  });
}

export function useStaffLeaves(status) {
  return useQuery({
    queryKey: STAFF_QUERY_KEYS.leaves(status),
    queryFn: () => listStaffLeaves({ status }),
  });
}

export function useReviewLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'leaves'] });
    },
  });
}

export function useStaffSalaries(monthYear) {
  return useQuery({
    queryKey: STAFF_QUERY_KEYS.salaries(monthYear),
    queryFn: () => listStaffSalaries({ monthYear }),
  });
}

export function useMarkSalaryPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markSalaryPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'salaries'] });
    },
  });
}

export function useGrantStaffLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: grantStaffLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'salaries'] });
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allProfiles });
    },
  });
}

