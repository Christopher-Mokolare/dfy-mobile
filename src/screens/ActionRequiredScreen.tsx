import React, { useCallback, useEffect, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { tasksApi } from '../api'
import { EmptyState, LoadingScreen } from '../components/Common'
import { COLORS, RADIUS, SPACING, SHADOW } from '../config/theme'

const norm=(v:any)=>String(v??'').toLowerCase().replace(/[_ -]/g,'')
const amount=(v:any)=>'R'+Number(v??0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})
export default function ActionRequiredScreen({navigation}:any){
 const [tasks,setTasks]=useState<any[]>([])
 const [loading,setLoading]=useState(true)
 const [refreshing,setRefreshing]=useState(false)
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true)
  try{
   const response=await tasksApi.getMyPosted()
   const data=response.data?.data
   const list=Array.isArray(data)?data:Array.isArray(data?.tasks)?data.tasks:Array.isArray(data?.items)?data.items:[]
   setTasks(list.filter((t:any)=>{
    const status=norm(t.taskStatus??t.status)
    const payment=norm(t.paymentStatus)
    return ['awaitingconfirmation','pendingpayment','actionrequired','payoutfailed','paymentfailed'].includes(status)||payment==='pending'||payment==='failed'
   }))
  }catch(e:any){Alert.alert('Unable to load action-required tasks',e.response?.data?.message||'Please refresh and try again.')}
  finally{setLoading(false);setRefreshing(false)}
 },[])
 useEffect(()=>{void load()},[load])
 if(loading)return <LoadingScreen message="Checking tasks that need your attention..." />
 return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={COLORS.primary}/>}>
  <View style={s.hero}><Text style={s.eyebrow}>CREATOR WORKSPACE</Text><Text style={s.title}>Action required</Text><Text style={s.subtitle}>Review tasks that may need payment, completion confirmation, or follow-up. Statuses come from the backend.</Text></View>
  {tasks.length===0?<EmptyState icon="✓" title="You're all caught up" subtitle="There are no posted tasks currently marked as needing your attention."/>:tasks.map((t:any,i:number)=>{
   const status=String(t.taskStatus??t.status??'Unknown')
   const key=String(t.taskId??t.id??i)
   const needsConfirm=norm(status)==='awaitingconfirmation'
   const needsPayment=norm(status)==='pendingpayment'||norm(t.paymentStatus)==='pending'
   return <View key={key} style={s.card}><View style={s.row}><Text style={s.taskTitle}>{t.taskName||t.title||'Your task'}</Text><Text style={s.amount}>{amount(t.budget??t.amount)}</Text></View><Text style={s.meta}>{t.area||t.location||'Location not provided'} · {status.replace(/([a-z])([A-Z])/g,'$1 $2')}</Text><Text style={s.message}>{needsConfirm?'The runner has marked this task complete. Review it within the 24-hour confirmation period.':needsPayment?'Payment is still pending. Open the task to review its current payment status.':'This task may need follow-up. Check the latest backend status before taking action.'}</Text><TouchableOpacity style={s.button} onPress={()=>navigation.navigate('MyPostedTasks')} accessibilityRole="button"><Text style={s.buttonText}>Open posted tasks</Text></TouchableOpacity></View>
  })}
  <TouchableOpacity style={s.secondary} onPress={()=>navigation.navigate('MyPostedTasks')}><Text style={s.secondaryText}>View all my posted tasks</Text></TouchableOpacity>
 </ScrollView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:COLORS.background},content:{paddingBottom:30,flexGrow:1},hero:{padding:SPACING.lg,backgroundColor:COLORS.primaryLight,borderBottomLeftRadius:24,borderBottomRightRadius:24,marginBottom:8},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:COLORS.primaryDark},title:{fontSize:28,fontWeight:'900',color:COLORS.textPrimary,marginTop:5},subtitle:{fontSize:13,lineHeight:20,color:COLORS.textSecondary,marginTop:5},card:{marginHorizontal:SPACING.md,marginTop:10,padding:SPACING.md,backgroundColor:COLORS.surface,borderRadius:RADIUS.lg,borderWidth:1,borderColor:COLORS.border,...SHADOW.sm},row:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},taskTitle:{flex:1,fontSize:15,fontWeight:'800',color:COLORS.textPrimary},amount:{fontSize:13,fontWeight:'900',color:COLORS.primaryDark},meta:{fontSize:11,color:COLORS.textMuted,marginTop:7},message:{fontSize:12,lineHeight:18,color:COLORS.textSecondary,marginTop:10},button:{alignSelf:'flex-start',marginTop:12,paddingHorizontal:14,paddingVertical:10,borderRadius:RADIUS.md,backgroundColor:COLORS.primary},buttonText:{fontSize:12,fontWeight:'800',color:COLORS.white},secondary:{alignSelf:'center',marginTop:18,padding:12},secondaryText:{fontSize:13,fontWeight:'800',color:COLORS.primaryDark}})
